'use strict';
// Browser-side extractor. It must stay self-contained (no closures over Node
// scope) because it is stringified into Playwright and into the DevTools snippet.
// Call as extractPage(window, { maxElements }).

function extractPage(win, opts) {
  opts = opts || {};
  const doc = win.document;
  const vw = win.innerWidth;
  const maxEls = opts.maxElements || 9000;
  const scrollY = win.scrollY || 0;

  // ---- colour normalisation through a 1px canvas (handles oklch(), lab(), color-mix()) ----
  const cv = doc.createElement('canvas');
  cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  function hex(c) {
    if (!c || c === 'transparent' || c === 'none' || c === 'currentcolor') return null;
    if (cache.has(c)) return cache.get(c);
    let out = null;
    ctx.fillStyle = '#010203';
    ctx.fillStyle = c;
    if (!(ctx.fillStyle === '#010203' && !/^#010203$/i.test(c))) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      if (d[3] > 0) {
        const h = (v) => v.toString(16).padStart(2, '0');
        out = '#' + h(d[0]) + h(d[1]) + h(d[2]) + (d[3] < 255 ? h(d[3]) : '');
      }
    }
    cache.set(c, out);
    return out;
  }
  const COLOR_FN = /(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\([^()]*\)/g;
  const normGradient = (s) => s.replace(COLOR_FN, (m) => hex(m) || 'transparent');
  const alphaOf = (h) => (h && h.length === 9 ? parseInt(h.slice(7), 16) / 255 : h ? 1 : 0);
  function lum(h) {
    const n = parseInt(h.slice(1, 7), 16);
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  }
  const px = (v) => { const n = parseFloat(v); return isFinite(n) ? Math.round(n * 100) / 100 : 0; };
  const bump = (map, key, by, extra) => {
    const e = map[key] || (map[key] = { n: 0 });
    e.n += by == null ? 1 : by;
    if (extra) for (const k in extra) e[k] = (e[k] || 0) + extra[k];
  };
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // ---- cookie / consent exclusion ----
  const CONSENT_ATTR = /cookie|consent|gdpr|onetrust|didomi|cookiebot|usercentrics|truste|trustarc|qc-cmp|osano|iubenda|klaro|tarteaucitron|privacy-?banner|cmp-container|sp_message/i;
  const CONSENT_TEXT = /\b(cookies?|consent|accept all|reject all|manage (my )?preferences|cookie settings|accetta|rifiuta)\b/i;
  function isConsent(el, cs) {
    if (el === doc.body || el === doc.documentElement) return false;
    const attr = (el.id || '') + ' ' + (el.getAttribute('class') || '') + ' ' + (el.getAttribute('aria-label') || '');
    if (CONSENT_ATTR.test(attr)) return true;
    const dialog = el.getAttribute('role') === 'dialog' || el.getAttribute('role') === 'alertdialog' || el.getAttribute('aria-modal') === 'true' || el.tagName === 'DIALOG';
    if (dialog || cs.position === 'fixed') {
      if (el.closest('header,nav,[role=banner]')) return false;
      const t = (el.innerText || '').slice(0, 3000);
      if (t.length < 3000 && CONSENT_TEXT.test(t)) return true;
    }
    return false;
  }

  // ---- effective ground (first painted ancestor) ----
  const groundCache = new Map();
  function ground(el) {
    const chain = [];
    let cur = el, found = null;
    while (cur && cur.nodeType === 1) {
      if (groundCache.has(cur)) { found = groundCache.get(cur); break; }
      chain.push(cur);
      const cs = win.getComputedStyle(cur);
      const bg = hex(cs.backgroundColor);
      if (bg && alphaOf(bg) >= 0.5) { found = bg.slice(0, 7); break; }
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && /url\(/.test(cs.backgroundImage)) { found = 'image'; break; }
      cur = cur.parentElement;
    }
    if (!found) found = '#ffffff';
    for (const c of chain) groundCache.set(c, found);
    return found;
  }

  const out = {
    url: win.location.href,
    title: doc.title,
    lang: doc.documentElement.lang || '',
    siteName: (doc.querySelector('meta[property="og:site_name"]') || {}).content || '',
    description: (doc.querySelector('meta[name="description"]') || {}).content || '',
    viewport: { w: vw, h: win.innerHeight },
    docW: doc.documentElement.scrollWidth,
    docH: Math.max(doc.documentElement.scrollHeight, doc.body ? doc.body.scrollHeight : 0),
    text: {}, bg: {}, border: {}, fill: {}, gradients: {}, shadows: {},
    spacing: { padding: {}, margin: {}, gap: {} },
    radius: {}, containers: {}, grids: {}, motion: { easing: {}, duration: {} },
    media: [], buttons: [], textLinks: {}, cards: [], inputs: [], header: null,
    headings: [], paragraphs: [], ctas: [], links: [], fonts: [], rootVars: {}, breakpoints: {},
    bands: [], elements: 0, excluded: 0, truncated: false,
  };

  const painted = []; // full-width painted blocks for section rhythm
  const btnEls = [], cardEls = [];
  const seenCardBoxes = new Set();
  const textTags = 'h1,h2,h3,h4,h5,h6,p,a,button,li,label,figcaption,blockquote,td,th,dt,dd,summary,legend';

  const walker = doc.createTreeWalker(doc.body || doc.documentElement, 1, {
    acceptNode(el) {
      const cs = win.getComputedStyle(el);
      if (cs.display === 'none') return 2;
      if (isConsent(el, cs)) { out.excluded++; return 2; }
      return 1;
    },
  });

  let el = walker.currentNode;
  while (el) {
    if (out.elements >= maxEls) { out.truncated = true; break; }
    const cs = win.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const visible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0 &&
      (typeof el.checkVisibility !== 'function' || el.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
    if (visible) {
      out.elements++;
      const tag = el.tagName.toLowerCase();
      const top = r.top + scrollY;
      const w = Math.min(r.width, vw), h = r.height;
      const area = Math.round(w * h);

      // typography: direct text nodes only
      let chars = 0;
      for (const n of el.childNodes) if (n.nodeType === 3) chars += n.textContent.replace(/\s+/g, ' ').trim().length;
      if (chars > 0) {
        const roleEl = el.closest(textTags);
        const role = roleEl ? roleEl.tagName.toLowerCase() : 'div';
        const size = px(cs.fontSize);
        const lh = cs.lineHeight === 'normal' ? Math.round(size * 1.2 * 100) / 100 : px(cs.lineHeight);
        const ls = cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing);
        const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        const color = hex(cs.color) || '#000000';
        const key = [fam, size, cs.fontWeight, lh, ls, role, color, ground(el), cs.textTransform, cs.fontStyle].join('|');
        bump(out.text, key, 1, { chars });
      }

      // colours
      const bgc = hex(cs.backgroundColor);
      if (bgc) bump(out.bg, bgc, 1, { area });
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        if (/gradient\(/.test(cs.backgroundImage)) bump(out.gradients, normGradient(cs.backgroundImage), 1, { area });
        if (/url\(/.test(cs.backgroundImage) && area > 2500) {
          const m = cs.backgroundImage.match(/url\(["']?([^"')]+)/);
          out.media.length < 250 && out.media.push({ kind: 'bg', src: m ? m[1].slice(0, 300) : '', w: Math.round(w), h: Math.round(h), fit: cs.backgroundSize, bleed: r.width >= vw * 0.98, alt: el.getAttribute('aria-label') || '', area, top: Math.round(top) });
        }
      }
      const bw = px(cs.borderTopWidth) || px(cs.borderBottomWidth) || px(cs.borderLeftWidth);
      if (bw > 0 && cs.borderTopStyle !== 'none') {
        const bc = hex(px(cs.borderTopWidth) ? cs.borderTopColor : px(cs.borderBottomWidth) ? cs.borderBottomColor : cs.borderLeftColor);
        if (bc) bump(out.border, bc);
      }
      if (el instanceof win.SVGElement && tag !== 'svg') {
        const f = hex(cs.fill); if (f) bump(out.fill, f, 1, { area });
        const s = cs.stroke !== 'none' && hex(cs.stroke); if (s) bump(out.fill, s, 1, { area: 0 });
      }
      if (cs.boxShadow && cs.boxShadow !== 'none') bump(out.shadows, normGradient(cs.boxShadow));

      // spacing
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        const p = px(cs['padding' + side]); if (p > 0) bump(out.spacing.padding, p);
        const m = px(cs['margin' + side]); if (m > 0 && cs['margin' + side] !== 'auto') bump(out.spacing.margin, m);
      }
      if (/flex|grid/.test(cs.display)) {
        const g1 = px(cs.rowGap), g2 = px(cs.columnGap);
        if (g1 > 0) bump(out.spacing.gap, g1);
        if (g2 > 0 && g2 !== g1) bump(out.spacing.gap, g2);
      }

      // radius
      const rad = cs.borderTopLeftRadius;
      if (rad && rad !== '0px') {
        const rv = /%/.test(rad) ? rad : px(rad);
        const pill = typeof rv === 'number' ? rv >= Math.min(r.width, r.height) / 2 - 1 : parseFloat(rad) >= 50;
        bump(out.radius, String(rv), 1, { pill: pill ? 1 : 0, wsum: Math.round(r.width), hsum: Math.round(r.height) });
      }

      // containers and grids
      if (cs.maxWidth && cs.maxWidth !== 'none' && /px$/.test(cs.maxWidth)) {
        const mw = px(cs.maxWidth);
        if (mw >= 320 && r.width >= Math.min(mw, vw) * 0.9) bump(out.containers, mw);
      }
      if (cs.display === 'grid' || cs.display === 'inline-grid') {
        const tracks = cs.gridTemplateColumns.split(/\s+(?![^(]*\))/).filter((t) => /px/.test(t)).length;
        if (tracks >= 2) bump(out.grids, tracks + '|' + px(cs.columnGap) + '|' + Math.round(r.width));
      }

      // motion
      if (cs.transitionDuration && cs.transitionDuration !== '0s') {
        cs.transitionTimingFunction.split(/,\s*(?![^(]*\))/).forEach((e) => bump(out.motion.easing, e.trim()));
        bump(out.motion.duration, cs.transitionDuration.split(',')[0].trim());
      }
      if (cs.animationName && cs.animationName !== 'none') bump(out.motion.easing, cs.animationTimingFunction.split(',')[0].trim());

      // media
      if ((tag === 'img' || tag === 'video' || tag === 'canvas' || (tag === 'svg' && area > 40000)) && area > 2500 && out.media.length < 250) {
        const src = el.currentSrc || el.src || (el.querySelector && el.querySelector('source') ? el.querySelector('source').src : '') || '';
        out.media.push({
          kind: tag, src: typeof src === 'string' ? src.slice(0, 300) : '', w: Math.round(r.width), h: Math.round(r.height),
          nw: el.naturalWidth || el.videoWidth || 0, nh: el.naturalHeight || el.videoHeight || 0,
          fit: cs.objectFit, bleed: r.width >= vw * 0.98, alt: el.getAttribute('alt') || el.getAttribute('aria-label') || '', area, top: Math.round(top),
        });
      }

      // full-width painted blocks, for the light/dark section rhythm
      if (r.width >= vw * 0.9 && h >= 80) {
        let tone = null;
        if (tag === 'img' || tag === 'video' || (cs.backgroundImage !== 'none' && /url\(/.test(cs.backgroundImage))) tone = 'image';
        else if (bgc && alphaOf(bgc) >= 0.6) tone = bgc.slice(0, 7);
        else if (/gradient\(/.test(cs.backgroundImage)) {
          const c = normGradient(cs.backgroundImage).match(/#[0-9a-f]{6}/i); if (c) tone = c[0];
        }
        if (tone) painted.push({ top, h, tone, area });
      }

      // buttons (the painted layer can be a child of the <a>)
      if ((tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button' || (tag === 'input' && /submit|button/.test(el.type))) &&
          r.width >= 32 && r.width <= 520 && r.height >= 22 && r.height <= 110) {
        const label = clean(el.innerText || el.value || el.getAttribute('aria-label'));
        if (label && label.length <= 48) {
          let layer = null;
          const cands = [el, ...Array.from(el.querySelectorAll(':scope > *, :scope > * > *')).slice(0, 8)];
          for (const c of cands) {
            const s = win.getComputedStyle(c);
            const b = hex(s.backgroundColor);
            const bwid = px(s.borderTopWidth);
            const rr = c.getBoundingClientRect();
            if (rr.width < 24 || rr.height < 20) continue;
            if ((b && alphaOf(b) > 0.04) || (bwid > 0 && s.borderTopStyle !== 'none' && hex(s.borderTopColor)) || (s.backdropFilter && s.backdropFilter !== 'none')) { layer = { c, s, b, bwid, rr }; break; }
          }
          if (layer) {
            const { c, s, b, bwid, rr } = layer;
            const textEl = Array.from(c.querySelectorAll('*')).find((x) => x.childNodes[0] && x.childNodes[0].nodeType === 3 && x.textContent.trim()) || c;
            const ts = win.getComputedStyle(textEl);
            const rv = px(s.borderTopLeftRadius);
            if (out.buttons.length < 200) btnEls.push(el);
            out.buttons.length < 200 && out.buttons.push({
              label, tag, bg: b, fg: hex(ts.color), borderW: bwid, borderColor: bwid ? hex(s.borderTopColor) : null,
              radius: rv, pill: rv >= rr.height / 2 - 1, h: Math.round(rr.height), w: Math.round(rr.width),
              padX: px(s.paddingLeft), padY: px(s.paddingTop), fontSize: px(ts.fontSize), weight: ts.fontWeight,
              family: ts.fontFamily.split(',')[0].replace(/["']/g, '').trim(), transform: ts.textTransform,
              tracking: ts.letterSpacing === 'normal' ? 0 : px(ts.letterSpacing), backdrop: s.backdropFilter !== 'none' ? s.backdropFilter : '',
              shadow: s.boxShadow !== 'none' ? normGradient(s.boxShadow) : '', ground: ground(el.parentElement || el), top: Math.round(top),
              inHeader: !!el.closest('header,nav,[role=banner]'),
            });
            out.ctas.length < 120 && out.ctas.push(label);
          } else if (tag === 'a' && !el.closest('header,nav,footer')) {
            bump(out.textLinks, [hex(cs.color), cs.textDecorationLine, cs.fontWeight].join('|'));
          }
        }
      }

      // cards
      if (/^(div|article|li|a|section|figure|aside)$/.test(tag) && r.width >= 160 && r.width <= Math.min(vw * 0.8, 960) && r.height >= 120) {
        const g = ground(el.parentElement || el);
        const fill = bgc && alphaOf(bgc) > 0.02 && bgc.slice(0, 7) !== g ? bgc : null;
        const sh = cs.boxShadow !== 'none';
        const bd = cs.backdropFilter && cs.backdropFilter !== 'none';
        const brd = bw > 0 && cs.borderTopStyle !== 'none';
        const hasMediaChild = !!el.querySelector('img,picture,video');
        const hasText = !!el.querySelector('h1,h2,h3,h4,h5,h6,p,strong');
        const rv = px(cs.borderTopLeftRadius);
        if ((fill || sh || bd || brd || (rv > 0 && hasMediaChild && cs.overflow !== 'visible')) && (hasMediaChild || hasText)) {
          const box = [Math.round(r.left), Math.round(top), Math.round(r.width), Math.round(r.height)].join(',');
          if (!seenCardBoxes.has(box) && out.cards.length < 200) {
            seenCardBoxes.add(box);
            const hd = el.querySelector('h1,h2,h3,h4,h5,h6');
            cardEls.push(el);
            out.cards.push({
              fill, backdrop: bd ? cs.backdropFilter : '', radius: rv, padT: px(cs.paddingTop), padL: px(cs.paddingLeft),
              shadow: sh ? normGradient(cs.boxShadow) : '', border: brd ? hex(cs.borderTopColor) : null, w: Math.round(r.width), h: Math.round(r.height),
              media: hasMediaChild ? 'child' : /url\(/.test(cs.backgroundImage) ? 'background' : 'none', ground: g,
              headingSize: hd ? px(win.getComputedStyle(hd).fontSize) : 0, top: Math.round(top),
            });
          }
        }
      }

      // form fields
      if ((tag === 'input' && !/hidden|checkbox|radio|submit|button|image|range|color|file/.test(el.type)) || tag === 'textarea' || tag === 'select') {
        out.inputs.length < 40 && out.inputs.push({
          tag, type: el.type || tag, h: Math.round(r.height), w: Math.round(r.width), padX: px(cs.paddingLeft), radius: px(cs.borderTopLeftRadius),
          borderW: px(cs.borderBottomWidth), borderColor: hex(cs.borderBottomColor), bg: hex(cs.backgroundColor), fg: hex(cs.color),
          fontSize: px(cs.fontSize), placeholder: (el.getAttribute('placeholder') || '').slice(0, 60),
        });
      }

      // copy
      if (/^h[1-6]$/.test(tag) && out.headings.length < 80) {
        const t = clean(el.innerText); if (t) out.headings.push({ tag, text: t.slice(0, 220), size: px(cs.fontSize), top: Math.round(top), transform: cs.textTransform });
      }
      if (tag === 'p' && out.paragraphs.length < 80) {
        const t = clean(el.innerText); if (t.length >= 30) out.paragraphs.push({ text: t.slice(0, 400), size: px(cs.fontSize) });
      }
    }
    el = walker.nextNode();
  }

  // What is really painted behind buttons and cards: hit-test the stack under their centre,
  // so photos, videos, gradients and pseudo-element grounds count.
  function paintOf(s) {
    const tag = s.tagName.toLowerCase();
    if (tag === 'img' || tag === 'video' || tag === 'canvas' || tag === 'picture') return 'image';
    for (const pseudo of [null, '::before', '::after']) {
      const cs = win.getComputedStyle(s, pseudo);
      if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
      const bg = hex(cs.backgroundColor);
      if (bg && alphaOf(bg) >= 0.5) return bg.slice(0, 7);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        if (/url\(/.test(cs.backgroundImage)) return 'image';
        const c = (normGradient(cs.backgroundImage).match(/#[0-9a-f]{6}(?![0-9a-f])/gi) || [])[0];
        if (c) return c;
      }
    }
    return null;
  }
  function groundAt(el) {
    let r = el.getBoundingClientRect();
    const vh = win.innerHeight;
    if (r.top < 0 || r.bottom > vh) { win.scrollTo({ top: r.top + win.scrollY - vh / 2, behavior: 'instant' }); r = el.getBoundingClientRect(); }
    const x = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1), y = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1);
    for (const s of doc.elementsFromPoint(x, y)) {
      if (s === el || el.contains(s)) continue;
      const p = paintOf(s);
      if (p) return p;
    }
    return null;
  }
  const y0 = win.scrollY;
  btnEls.forEach((b, i) => { const g = groundAt(b); if (g) out.buttons[i].ground = g; });
  cardEls.forEach((c, i) => { const g = groundAt(c); if (g && out.cards[i]) out.cards[i].ground = g; });
  win.scrollTo({ top: y0, behavior: 'instant' });

  // header and nav
  const hdr = Array.from(doc.querySelectorAll('header,[role=banner],nav')).find((h) => {
    const r = h.getBoundingClientRect();
    return r.width > vw * 0.5 && r.top < 200 && r.height > 20 && r.height < 260;
  });
  if (hdr) {
    const cs = win.getComputedStyle(hdr);
    const r = hdr.getBoundingClientRect();
    let pos = cs.position, n = hdr;
    while (n && pos === 'static' && n !== doc.body) { n = n.parentElement; if (n) pos = win.getComputedStyle(n).position; }
    const links = Array.from(hdr.querySelectorAll('a')).filter((a) => a.getBoundingClientRect().width > 0 && clean(a.innerText));
    const ls = {};
    links.forEach((a) => { const s = win.getComputedStyle(a); bump(ls, [px(s.fontSize), s.fontWeight, hex(s.color), s.textTransform, s.textDecorationLine].join('|')); });
    const logoEl = hdr.querySelector('a[href="/"] svg, a[href="/"] img, [class*=logo] svg, [class*=logo] img, svg, img');
    let logo = null;
    if (logoEl) {
      const lr = logoEl.getBoundingClientRect();
      const shape = logoEl.tagName.toLowerCase() === 'svg' ? logoEl.querySelector('path,rect,circle,polygon,use') : null;
      const lcs = win.getComputedStyle(shape || logoEl);
      logo = { kind: logoEl.tagName.toLowerCase(), w: Math.round(lr.width), h: Math.round(lr.height), color: shape ? hex(lcs.fill) || hex(lcs.color) : hex(lcs.color), label: logoEl.getAttribute('alt') || logoEl.getAttribute('aria-label') || (logoEl.closest('a') || {}).ariaLabel || '' };
    }
    const bgc = hex(cs.backgroundColor);
    out.header = {
      h: Math.round(r.height), position: pos, sticky: pos === 'sticky' || pos === 'fixed', bg: bgc,
      backdrop: cs.backdropFilter !== 'none' ? cs.backdropFilter : '', ground: ground(hdr), linkCount: links.length,
      linkStyles: ls, links: links.slice(0, 12).map((a) => clean(a.innerText).slice(0, 40)), logo,
      padX: px(cs.paddingLeft), borderBottom: px(cs.borderBottomWidth) ? hex(cs.borderBottomColor) : null,
    };
  }

  // same-origin links for page scoring
  const origin = win.location.origin;
  for (const a of doc.querySelectorAll('a[href]')) {
    let u;
    try { u = new URL(a.getAttribute('href'), win.location.href); } catch (e) { continue; }
    if (u.origin !== origin || !/^https?:$/.test(u.protocol)) continue;
    if (a.closest('[id*=cookie i],[class*=cookie i],[id*=consent i],[class*=consent i]')) continue;
    u.hash = '';
    out.links.length < 600 && out.links.push({
      href: u.href, text: clean(a.innerText).slice(0, 60),
      nav: !!a.closest('header,nav,[role=banner],[role=navigation]'), footer: !!a.closest('footer,[role=contentinfo]'),
    });
  }

  // fonts that the page declared/loaded (names only; files are never fetched)
  try { doc.fonts.forEach((f) => out.fonts.push({ family: f.family.replace(/["']/g, ''), weight: f.weight, style: f.style, status: f.status })); } catch (e) {}

  // :root custom properties and breakpoints from same-origin sheets
  const rootStyle = win.getComputedStyle(doc.documentElement);
  const walkRules = (rules) => {
    for (const rule of rules) {
      if (rule.selectorText && /(^|,)\s*(:root|html)\s*(,|$)/.test(rule.selectorText)) {
        for (const name of rule.style) if (name.startsWith('--')) out.rootVars[name] = clean(rootStyle.getPropertyValue(name) || rule.style.getPropertyValue(name)).slice(0, 200);
      }
      if (rule.media) {
        const m = rule.media.mediaText.match(/(min|max)-width:\s*([\d.]+)(px|em|rem)/g) || [];
        m.forEach((q) => { const p = q.match(/(min|max)-width:\s*([\d.]+)(px|em|rem)/); const v = Math.round(parseFloat(p[2]) * (p[3] === 'px' ? 1 : 16)); bump(out.breakpoints, p[1] + ':' + v); });
      }
      if (rule.cssRules) try { walkRules(rule.cssRules); } catch (e) {}
    }
  };
  for (const sheet of doc.styleSheets) { try { walkRules(sheet.cssRules); } catch (e) { /* cross-origin: parsed in Node */ } }

  // section rhythm: sample the page every 40px and pick the most specific painted block
  const bodyBg = hex(win.getComputedStyle(doc.body).backgroundColor) || hex(rootStyle.backgroundColor) || '#ffffff';
  const toneOf = (t) => (t === 'image' ? 'image' : lum(t) < 0.18 ? 'dark' : 'light');
  let last = null;
  for (let y = 0; y < out.docH; y += 40) {
    let best = null;
    for (const p of painted) if (y >= p.top && y < p.top + p.h && (!best || p.area < best.area)) best = p;
    const color = best ? best.tone : bodyBg.slice(0, 7);
    const tone = toneOf(color);
    if (last && last.tone === tone) { last.h += 40; } else { last = { top: y, h: 40, tone, color }; out.bands.push(last); }
  }
  out.bands = out.bands.filter((b) => b.h >= 80);
  out.bodyBg = bodyBg;
  return out;
}

if (typeof module !== 'undefined') module.exports = { extractPage };
