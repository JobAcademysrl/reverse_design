'use strict';
const C = require('./color');
const { round } = require('./util');

// ---------- helpers ----------
// Repeated chrome: a count identical on every page (header, footer) is counted once.
function mergeMaps(maps) {
  maps = maps.filter(Boolean);
  const out = {};
  const keys = new Set(maps.flatMap((m) => Object.keys(m)));
  for (const k of keys) {
    const vals = maps.map((m) => m[k]);
    const same = maps.length > 1 && vals.every((v) => v && v.n === vals[0].n);
    if (same) { out[k] = { ...vals[0], pages: maps.length, chrome: true }; continue; }
    const acc = { n: 0, pages: 0 };
    for (const v of vals) {
      if (!v) continue;
      acc.pages++;
      for (const f in v) if (typeof v[f] === 'number') acc[f] = (acc[f] || 0) + v[f];
    }
    out[k] = acc;
  }
  return out;
}

// Same rule for lists of objects: group by a signature, count per page, merge.
function mergeLists(lists, sig) {
  const maps = lists.map((list) => {
    const m = {};
    for (const it of list || []) { const k = sig(it); (m[k] = m[k] || { n: 0, item: it }).n++; }
    return m;
  });
  const keys = new Set(maps.flatMap((m) => Object.keys(m)));
  const out = [];
  for (const k of keys) {
    const vals = maps.map((m) => m[k]);
    const same = maps.length > 1 && vals.every((v) => v && v.n === vals[0].n);
    const n = same ? vals[0].n : vals.reduce((s, v) => s + (v ? v.n : 0), 0);
    out.push({ key: k, n, item: vals.find(Boolean).item, chrome: same });
  }
  return out.sort((a, b) => b.n - a.n);
}

function mode(pairs) { // [[value, weight]] -> value with most weight
  const m = new Map();
  for (const [v, w] of pairs) m.set(v, (m.get(v) || 0) + w);
  let best = null, bw = -1;
  for (const [v, w] of m) if (w > bw) { best = v; bw = w; }
  return best;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const sum = (a, f = (x) => x) => a.reduce((s, x) => s + f(x), 0);
const isHeadingTag = (t) => /^h[1-6]$/.test(t);

// ---------- typography ----------
function parseText(map) {
  return Object.entries(map || {}).map(([k, v]) => {
    const [family, size, weight, lh, ls, role, color, ground, transform, style] = k.split('|');
    return { family, size: +size, weight: +weight || 400, lh: +lh, ls: +ls, role, color, ground, transform, style, n: v.n, chars: v.chars || 0 };
  }).filter((e) => e.size > 0 && e.chars > 0);
}

function clusterSizes(entries) {
  const bySize = new Map();
  for (const e of entries) { const s = bySize.get(e.size) || []; s.push(e); bySize.set(e.size, s); }
  const sizes = [...bySize.keys()].sort((a, b) => b - a);
  const clusters = [];
  let cur = null;
  for (const s of sizes) {
    if (!cur || s < cur.top / 1.12) { cur = { top: s, sizes: [], entries: [] }; clusters.push(cur); }
    cur.sizes.push(s);
    cur.entries.push(...bySize.get(s));
  }
  return clusters.map((c) => {
    const E = c.entries;
    const chars = sum(E, (e) => e.chars);
    const tags = {};
    E.forEach((e) => { tags[e.role] = (tags[e.role] || 0) + e.chars; });
    const headingChars = sum(Object.entries(tags).filter(([t]) => isHeadingTag(t)), ([, v]) => v);
    return {
      size: mode(E.map((e) => [e.size, e.chars])),
      sizes: c.sizes,
      weight: mode(E.map((e) => [e.weight, e.chars])),
      lhRatio: round(mode(E.map((e) => [round(e.lh / e.size, 2), e.chars])), 2),
      trackingEm: round(mode(E.map((e) => [round(e.ls / e.size, 3), e.chars])), 3),
      family: mode(E.map((e) => [e.family, e.chars])),
      transform: mode(E.map((e) => [e.transform, e.chars])),
      chars, n: sum(E, (e) => e.n), tags,
      topTag: mode(Object.entries(tags)),
      headingShare: chars ? headingChars / chars : 0,
      pShare: chars ? (tags.p || 0) / chars : 0,
    };
  });
}

function assignRoles(clusters) {
  const roles = {};
  const total = sum(clusters, (c) => c.chars) || 1;
  const pick = (lo, hi) => clusters.filter((c) => c.size >= lo && c.size <= hi && c.headingShare < 0.5);
  const bodyCands = pick(14, 19.5).length ? pick(14, 19.5) : pick(12, 24);
  roles.body = (bodyCands.length ? bodyCands : clusters).reduce((a, b) => (b.chars > a.chars ? b : a));
  const body = roles.body;
  const smaller = clusters.filter((c) => c.size < body.size);
  if (smaller.length) roles.small = smaller.reduce((a, b) => (b.chars > a.chars ? b : a));
  let heads = clusters.filter((c) => c.size > body.size * 1.12);
  const leadCands = heads.filter((c) => c.size < body.size * 1.6 && c.headingShare < 0.3 && (c.pShare > 0.25 || c.topTag === 'div'));
  if (leadCands.length) {
    roles.lead = leadCands.reduce((a, b) => (b.chars > a.chars ? b : a));
    heads = heads.filter((c) => c !== roles.lead);
  }
  const headTotal = sum(heads, (c) => c.chars) || 1;
  heads = heads.filter((c) => c.headingShare > 0.3 || c.chars / headTotal > 0.01 || c.size >= 40);
  heads.sort((a, b) => b.size - a.size);
  const order = ['h1', 'h2', 'h3', 'h4'];
  if (heads.length && (heads[0].size >= 48 || heads.length >= 5)) roles.display = heads.shift();
  if (heads.length > 4) {
    // keep the four most used, in size order
    heads = heads.slice().sort((a, b) => b.chars - a.chars).slice(0, 4).sort((a, b) => b.size - a.size);
  }
  heads.forEach((c, i) => { roles[order[i]] = c; });
  roles._total = total;
  return roles;
}

const STEPS = { h4: 1, h3: 2, h2: 3, h1: 4, display: 5 };
const INTERVALS = [
  ['minor second', 1.067], ['major second', 1.125], ['minor third', 1.2], ['major third', 1.25],
  ['perfect fourth', 1.333], ['augmented fourth', 1.414], ['perfect fifth', 1.5], ['golden ratio', 1.618],
];

function clampExpr(minPx, maxPx) {
  if (Math.abs(maxPx - minPx) < 0.5) return `${round(maxPx / 16, 4)}rem`;
  const lo = Math.min(minPx, maxPx), hi = Math.max(minPx, maxPx);
  const slope = (maxPx - minPx) / (1440 - 390);
  const intercept = minPx - slope * 390;
  return `clamp(${round(lo / 16, 4)}rem, ${round(intercept / 16, 4)}rem + ${round(slope * 100, 4)}vw, ${round(hi / 16, 4)}rem)`;
}

function typography(desktopText, mobileText, headings, assume) {
  const entries = parseText(desktopText);
  const clusters = clusterSizes(entries);
  const R = assignRoles(clusters);
  const mClusters = clusterSizes(parseText(mobileText));
  const MR = mClusters.length ? assignRoles(mClusters) : {};
  const mEntries = parseText(mobileText);
  const body = R.body;

  // scale ratio from measured headings
  const ratios = Object.entries(STEPS).filter(([k]) => R[k]).map(([k, s]) => Math.pow(R[k].size / body.size, 1 / s));
  const ratio = ratios.length ? median(ratios) : 1.25;
  const nearest = INTERVALS.reduce((a, b) => (Math.abs(b[1] - ratio) < Math.abs(a[1] - ratio) ? b : a));

  const roles = {};
  const names = ['display', 'h1', 'h2', 'h3', 'h4', 'lead', 'body', 'small'];
  const headingFallback = R.h1 || R.h2 || R.display || R.h3 || body;
  // missing roles sit geometrically between their measured neighbours
  const ladder = ['display', 'h1', 'h2', 'h3', 'h4', 'body'];
  const inferSize = (name) => {
    if (name === 'lead') return Math.min(body.size * 1.2, R.h4 ? R.h4.size * 0.92 : Infinity);
    if (name === 'small') return body.size * 0.875;
    const i = ladder.indexOf(name);
    let a = i - 1; while (a >= 0 && !R[ladder[a]]) a--;
    let b = i + 1; while (b < ladder.length && !R[ladder[b]]) b++;
    const B = R[ladder[b]].size;
    if (a < 0) return B * Math.pow(ratio, b - i);
    const A = R[ladder[a]].size;
    return B * Math.pow(A / B, (b - i) / (b - a));
  };
  for (const name of names) {
    let c = R[name], inferred = false;
    if (!c) {
      inferred = true;
      const size = inferSize(name);
      const ref = name === 'lead' || name === 'small' ? body : headingFallback;
      c = { ...ref, size: Math.round(size), chars: 0, tags: {}, topTag: name === 'lead' || name === 'small' ? 'p' : name };
      assume(`Type role "${name}" was not measured; inferred at ${Math.round(size)}px between its measured neighbours (${nearest[0]} scale).`);
    }
    // mobile size: same heading tag on the 390px pass, else the same role
    let mobile = null;
    if (isHeadingTag(c.topTag)) {
      const m = mEntries.filter((e) => e.role === c.topTag);
      if (m.length) mobile = mode(m.map((e) => [e.size, e.chars]));
    }
    if (inferred) mobile = null;
    else if (!mobile && MR[name]) mobile = MR[name].size;
    if (name === 'display' && mClusters.length) mobile = Math.min(mobile || Infinity, mClusters[0].size);
    if (!inferred && (!mobile || !isFinite(mobile))) mobile = c.size;
    if (mobile) mobile = Math.min(mobile, c.size);
    const sample = (headings || []).filter((h) => Math.abs(h.size - c.size) / c.size < 0.12).map((h) => h.text).find((t) => t.split(' ').length <= 12) || '';
    roles[name] = {
      size: c.size, mobile, clamp: clampExpr(mobile, c.size), lhRatio: c.lhRatio || 1.2, weight: c.weight, trackingEm: c.trackingEm || 0,
      family: c.family, transform: c.transform || 'none', share: round(c.chars / R._total, 3), tag: c.topTag, inferred, sizes: c.sizes, sample,
    };
  }

  // inferred roles shrink on mobile like their measured neighbours
  const order = ['display', 'h1', 'h2', 'h3', 'h4', 'lead', 'body', 'small'];
  for (const name of order) {
    const r = roles[name];
    if (r.mobile) continue;
    const i = order.indexOf(name);
    const near = [order[i - 1], order[i + 1]].map((k) => roles[k]).filter((x) => x && x.mobile && !x.inferred);
    const f = near.length ? sum(near, (x) => x.mobile / x.size) / near.length : 1;
    r.mobile = Math.round(r.size * f);
    r.clamp = clampExpr(r.mobile, r.size);
  }

  // families
  const famChars = {};
  const famWeights = {};
  entries.forEach((e) => {
    famChars[e.family] = (famChars[e.family] || 0) + e.chars;
    const w = (famWeights[e.family] = famWeights[e.family] || {});
    w[e.weight] = (w[e.weight] || 0) + e.chars;
  });
  const totalChars = sum(Object.values(famChars)) || 1;
  const families = Object.entries(famChars).sort((a, b) => b[1] - a[1]).map(([family, chars]) => {
    const wt = famWeights[family];
    const wsum = sum(Object.values(wt));
    const usedBy = names.filter((n) => roles[n].family === family && !roles[n].inferred);
    return {
      family, share: round(chars / totalChars, 3), generic: genericOf(family),
      weights: Object.entries(wt).sort((a, b) => b[1] - a[1]).map(([w, c]) => ({ weight: +w, share: round(c / wsum, 3) })), roles: usedBy,
    };
  }).filter((f) => f.share >= 0.03 || f.roles.length);

  const sizesInUse = [...new Set(entries.map((e) => e.size))].sort((a, b) => b - a)
    .map((s) => ({ size: s, chars: sum(entries.filter((e) => e.size === s), (e) => e.chars) }));

  return { roles, ratio: round(ratio, 3), interval: { name: nearest[0], value: nearest[1] }, clusters: clusters.length, families, sizesInUse };
}

function genericOf(f) {
  const s = f.toLowerCase();
  if (/mono|code|courier|consolas|menlo/.test(s)) return 'monospace';
  if (/sans|grotesk|grotesque|gothic|helvetica|arial|inter|roboto/.test(s)) return 'sans-serif';
  if (/serif|georgia|times|garamond|playfair|merriweather|lora|tiempos|freight|canela|domaine|baskerville|didot|caslon|bodoni/.test(s)) return 'serif';
  return 'sans-serif';
}
const FALLBACK = {
  'sans-serif': '"Helvetica Neue", Arial, system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  monospace: 'ui-monospace, "SFMono-Regular", Menlo, monospace',
};

// ---------- colour ----------
function colour(pages, merged, buttonsGroups, assume) {
  const text = parseText(merged.text);
  const textBy = {}; const pairs = {};
  text.forEach((e) => {
    textBy[e.color] = (textBy[e.color] || 0) + e.chars;
    if (e.ground && e.ground !== 'image') { const k = e.color + '|' + e.ground; pairs[k] = (pairs[k] || 0) + e.chars; }
  });
  const bgArea = {};
  for (const [h, v] of Object.entries(merged.bg)) bgArea[h] = (bgArea[h] || 0) + (v.area || 0);
  // the page ground covers the whole document
  const bodyMap = pages.map((p) => ({ [(p.bodyBg || '#ffffff').slice(0, 9)]: { n: 1, area: p.docW * p.docH } }));
  for (const [h, v] of Object.entries(mergeMaps(bodyMap))) bgArea[h] = (bgArea[h] || 0) + v.area;

  const totalText = sum(Object.values(textBy)) || 1;
  const totalBg = sum(Object.values(bgArea)) || 1;
  const opaqueBg = Object.entries(bgArea).filter(([h]) => C.alpha(h) >= 0.9).sort((a, b) => b[1] - a[1]);
  const role = (hex, share, source, inferred = false) => ({ hex: C.opaque(hex), oklch: C.oklchString(C.opaque(hex)), share: round(share, 3), source, inferred });

  const background = opaqueBg.length ? opaqueBg[0][0] : '#ffffff';
  const bgL = C.oklch(background).L;
  const surfaceE = opaqueBg.find(([h]) => C.distance(h, background) > 0.015 && Math.abs(C.oklch(h).L - bgL) < 0.2);
  const inverseE = opaqueBg.find(([h]) => Math.abs(C.oklch(h).L - bgL) > 0.4);
  const sameTone = (g) => Math.abs(C.oklch(g).L - bgL) < 0.3;
  const onBg = {}, onInv = {};
  for (const [k, c] of Object.entries(pairs)) {
    const [fg, g] = k.split('|');
    const f = C.over(fg, g);
    (sameTone(g) ? onBg : onInv)[f] = ((sameTone(g) ? onBg : onInv)[f] || 0) + c;
  }
  const rank = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]);
  const fgOnBg = rank(onBg);
  const textE = fgOnBg.find(([h]) => C.contrast(h, background) >= 4.5) || fgOnBg[0];
  const textHex = textE ? textE[0] : (bgL > 0.5 ? '#111111' : '#ffffff');
  const mutedE = fgOnBg.find(([h]) => h !== textHex && C.distance(h, textHex) > 0.03 && C.contrast(h, background) >= 2.5 && C.contrast(h, background) < C.contrast(textHex, background) && C.oklch(h).C < 0.08);
  const inv = rank(onInv);
  const invGround = inverseE ? inverseE[0] : textHex;
  const invE = inv.slice(0, 3).find(([h]) => C.contrast(h, invGround) >= 7) || inv[0];

  const R = {};
  R.background = role(background, (bgArea[background] || 0) / totalBg, 'largest painted area');
  R.surface = surfaceE ? role(surfaceE[0], surfaceE[1] / totalBg, 'second ground of the same tone') : role(C.mix(background, textHex, 0.04), 0, 'inferred: 4% text over background', true);
  R['surface-inverse'] = inverseE ? role(inverseE[0], inverseE[1] / totalBg, 'largest ground of the opposite tone') : role(textHex, 0, 'inferred: text colour', true);
  R.text = role(textHex, (textBy[textHex] || (textE ? textE[1] : 0)) / totalText, 'most-read text on the main ground');
  R['text-muted'] = mutedE ? role(mutedE[0], mutedE[1] / totalText, 'secondary neutral text') : role(C.mix(textHex, background, 0.38), 0, 'inferred: text mixed 38% toward background', true);
  R['text-inverse'] = invE ? role(invE[0], invE[1] / totalText, 'most-read text on inverse grounds') : role(background, 0, 'inferred: background colour', true);

  const filled = buttonsGroups.filter((g) => g.variant === 'filled');
  const onMain = (g) => g.ground && g.ground !== 'image' && Math.abs(C.oklch(g.ground).L - bgL) < 0.3;
  const actionG = filled.filter((g) => !g.inHeader && onMain(g)).sort((a, b) => b.n - a.n)[0] || filled.find((g) => !g.inHeader) || filled[0];
  if (actionG) {
    R.action = role(C.over(actionG.bg, actionG.ground), actionG.n / (sum(buttonsGroups, (g) => g.n) || 1), `filled button "${actionG.labels[0]}"`);
    R['on-action'] = role(C.over(actionG.fg || '#ffffff', C.over(actionG.bg, actionG.ground)), 0, 'label colour of that button');
  } else {
    R.action = role(R['surface-inverse'].hex, 0, 'inferred: no filled button found', true);
    R['on-action'] = role(R['text-inverse'].hex, 0, 'inferred', true);
    assume('No filled button was measured; action colour falls back to surface-inverse.');
  }
  const altG = filled.find((g) => C.distance(C.over(g.bg, g.ground), R.action.hex) > 0.05) || buttonsGroups.find((g) => g.variant === 'outline');
  R['action-alt'] = altG ? role(C.over(altG.variant === 'outline' ? altG.borderColor || altG.fg : altG.bg, altG.ground), altG.n / (sum(buttonsGroups, (g) => g.n) || 1), `${altG.variant} button "${altG.labels[0]}"`)
    : role(R['surface-inverse'].hex, 0, 'inferred: surface-inverse', true);

  // accent: the most chromatic colour with real usage
  const usage = {};
  const add = (h, k, v) => { if (!h || h === 'image') return; const o = C.over(h, background); const u = (usage[o] = usage[o] || { text: 0, bg: 0, border: 0, fill: 0 }); u[k] += v; };
  Object.entries(textBy).forEach(([h, v]) => add(h, 'text', v));
  Object.entries(bgArea).forEach(([h, v]) => add(h, 'bg', v));
  Object.entries(merged.border).forEach(([h, v]) => add(h, 'border', v.n));
  Object.entries(merged.fill).forEach(([h, v]) => add(h, 'fill', v.n));
  const totals = { text: totalText, bg: totalBg, border: sum(Object.values(merged.border), (v) => v.n) || 1, fill: sum(Object.values(merged.fill), (v) => v.n) || 1 };
  const palette = Object.entries(usage).map(([hex, u]) => {
    const score = u.text / totals.text + u.bg / totals.bg + 0.3 * (u.border / totals.border) + 0.3 * (u.fill / totals.fill);
    return { hex, oklch: C.oklchString(hex), score: round(score, 4), text: round(u.text / totals.text, 3), bg: round(u.bg / totals.bg, 3), border: round(u.border / totals.border, 3), fill: round(u.fill / totals.fill, 3) };
  }).filter((p) => p.score > 0.0005).sort((a, b) => b.score - a.score).slice(0, 48);
  const accentE = palette.filter((p) => C.oklch(p.hex).C > 0.08 && C.distance(p.hex, R.action.hex) > 0.05).sort((a, b) => C.oklch(b.hex).C * Math.sqrt(b.score) - C.oklch(a.hex).C * Math.sqrt(a.score))[0];
  R.accent = accentE ? role(accentE.hex, accentE.score, 'most chromatic colour in use') : role(C.oklch(R.action.hex).C > 0.06 ? R.action.hex : R['action-alt'].hex, 0, 'inferred: action colour', true);
  const borderE = Object.entries(merged.border).sort((a, b) => b[1].n - a[1].n)[0];
  R.border = borderE ? role(C.over(borderE[0], background), borderE[1].n / totals.border, 'most used border') : role(C.mix(textHex, background, 0.86), 0, 'inferred: 14% text over background', true);
  if (!borderE) assume('No borders measured; border colour inferred.');

  // gradients
  const gradients = Object.entries(merged.gradients).map(([g, v]) => ({ css: g, area: v.area || 0, n: v.n }))
    .sort((a, b) => b.area - a.area).slice(0, 8)
    .map((g) => ({ ...g, colors: (g.css.match(/#[0-9a-f]{6,8}/gi) || []) }));
  const brandG = gradients.find((g) => new Set(g.colors.map((c) => c.slice(0, 7))).size >= 2 && g.colors.some((c) => C.alpha(c) > 0.9 && C.oklch(c.slice(0, 7)).C > 0.03));
  const brandGradient = brandG ? { css: brandG.css.replace(/^.*?((?:linear|radial|conic)-gradient\()/, '$1').replace(/(,\s*none)+\s*$/, ''), inferred: false }
    : { css: `linear-gradient(135deg, ${R['surface-inverse'].hex} 0%, ${R.action.hex} 55%, ${R.accent.hex} 100%)`, inferred: true };
  if (brandGradient.inferred) assume('No brand gradient found on the site; the guide uses surface-inverse → action → accent.');

  // pairs below 1.6:1 are text set over imagery whose painted ground is a photo, not the box behind it
  const allPairs = Object.entries(pairs).sort((a, b) => b[1] - a[1]).map(([k, c]) => {
    const [fg, g] = k.split('|');
    const f = C.over(fg, g);
    const ratio = C.contrast(f, g);
    return { fg: f, bg: g, ratio: round(ratio, 2), level: C.wcag(ratio), share: round(c / totalText, 3) };
  });
  const contrastPairs = allPairs.filter((p) => p.ratio >= 1.6).slice(0, 8);
  const onImage = allPairs.filter((p) => p.ratio < 1.6);
  if (onImage.length) assume(`${onImage.length} text/ground pairs under 1.6:1 were treated as text over images and left out of the contrast table.`);
  return { roles: R, palette, gradients, brandGradient, contrastPairs, onImageShare: round(sum(onImage, (p) => p.share), 3), counts: { text: Object.keys(textBy).length, bg: Object.keys(bgArea).length } };
}

// ---------- layout ----------
function layout(pages, merged, home, cssBp, assume) {
  const all = {};
  for (const kind of ['padding', 'margin', 'gap']) for (const [v, e] of Object.entries(merged.spacing[kind])) all[v] = (all[v] || 0) + e.n;
  const vals = Object.entries(all).map(([v, n]) => ({ v: +v, n })).filter((x) => x.v >= 1 && x.v <= 400);
  const total = sum(vals, (x) => x.n) || 1;
  const share = (b) => sum(vals.filter((x) => x.v % b === 0), (x) => x.n) / total;
  const base = share(8) >= 0.6 ? 8 : share(4) >= 0.6 ? 4 : 2;
  const onGrid = vals.filter((x) => x.v % base === 0).sort((a, b) => a.v - b.v);
  const offGrid = vals.filter((x) => x.v % base !== 0).sort((a, b) => b.n - a.n);
  const scale = [...new Set([base, ...onGrid.slice().sort((a, b) => b.n - a.n).slice(0, 11).map((x) => x.v)])].sort((a, b) => a - b).slice(0, 12);

  // radii
  const rad = Object.entries(merged.radius).map(([v, e]) => ({ v: parseFloat(v), raw: v, n: e.n, pill: (e.pill || 0) / e.n > 0.5 }));
  const pillN = sum(rad.filter((r) => r.pill || r.v >= 999), (r) => r.n);
  const pxR = rad.filter((r) => !r.pill && r.v < 999 && !/%/.test(r.raw)).sort((a, b) => b.n - a.n);
  const radii = [];
  for (const r of pxR) if (!radii.some((x) => Math.abs(x.v - r.v) <= 2)) radii.push({ v: r.v, n: r.n });
  const radiusScale = radii.slice(0, 4).sort((a, b) => a.v - b.v);

  // container, columns, gutter
  const cont = Object.entries(merged.containers).map(([v, e]) => ({ v: +v, n: e.n })).sort((a, b) => b.n - a.n);
  const wide = cont.filter((c) => c.v >= 900);
  let container = (wide[0] || cont[0] || {}).v;
  if (!container) { container = 1200; assume('No max-width container found; 1200px assumed.'); }
  const grids = Object.entries(merged.grids).map(([k, e]) => { const [t, g, w] = k.split('|').map(Number); return { tracks: t, gap: g, width: w, n: e.n }; });
  const bigGrids = grids.filter((g) => g.width >= container * 0.6);
  const trackMode = mode((bigGrids.length ? bigGrids : grids).map((g) => [g.tracks, g.n]));
  const gapMode = mode((bigGrids.length ? bigGrids : grids).filter((g) => g.gap > 0).map((g) => [g.gap, g.n]));
  const gutter = gapMode || mode(Object.entries(merged.spacing.gap).map(([v, e]) => [+v, e.n])) || base * 3;
  const observed = [...new Set(grids.map((g) => g.tracks))].sort((a, b) => a - b);
  let columns = trackMode || 12, columnsInferred = !trackMode;
  if (observed.length && observed.every((t) => 12 % t === 0) && trackMode !== 12) { columns = 12; columnsInferred = true; }
  if (columnsInferred) assume(`Column count set to ${columns}: observed grid tracks ${observed.join(', ') || 'none'} all divide it.`);

  // breakpoints
  const bp = {};
  const addBp = (m) => Object.entries(m || {}).forEach(([k, v]) => { bp[k] = (bp[k] || 0) + (typeof v === 'number' ? v : v.n); });
  addBp(cssBp);
  pages.forEach((p) => addBp(p.breakpoints));
  const byVal = {};
  for (const [k, n] of Object.entries(bp)) { const [type, v] = k.split(':'); const val = +v; if (val < 300 || val > 2600) continue; (byVal[val] = byVal[val] || { v: val, n: 0, types: new Set() }).n += n; byVal[val].types.add(type); }
  const breakpoints = Object.values(byVal).sort((a, b) => b.n - a.n).slice(0, 7).sort((a, b) => a.v - b.v).map((b) => ({ v: b.v, n: b.n, types: [...b.types] }));

  const bands = (home.bands || []).map((b) => ({ ...b }));
  const darkShare = sum(bands.filter((b) => b.tone === 'dark'), (b) => b.h) / (sum(bands, (b) => b.h) || 1);
  return {
    base, baseShare: round(share(base), 3), onGrid, offGrid: offGrid.slice(0, 16), scale,
    radii: { scale: radiusScale, pillShare: round(pillN / (sum(rad, (r) => r.n) || 1), 3), all: rad.sort((a, b) => b.n - a.n).slice(0, 16) },
    container, containers: cont.slice(0, 8), columns, columnsInferred, observedTracks: observed, gutter,
    breakpoints, bands, darkShare: round(darkShare, 3),
  };
}

// ---------- components ----------
function components(pages, typo, col, lay, assume) {
  const sig = (b) => {
    const a = b.bg ? C.alpha(b.bg) : 0;
    const variant = b.backdrop || (b.bg && a > 0.04 && a < 0.85) ? 'translucent' : b.bg && a >= 0.85 ? 'filled' : b.borderW > 0 ? 'outline' : 'text';
    return [variant, b.bg, b.fg, b.borderColor, Math.round(b.radius), b.pill, Math.round(b.h / 4) * 4].join('|');
  };
  const groups = mergeLists(pages.map((p) => p.buttons), sig).map((g) => {
    const [variant] = g.key.split('|');
    const members = pages.flatMap((p) => p.buttons).filter((b) => sig(b) === g.key);
    return {
      variant, n: g.n, chrome: g.chrome, bg: g.item.bg, fg: g.item.fg, borderW: g.item.borderW, borderColor: g.item.borderColor,
      radius: g.item.radius, pill: g.item.pill, h: median(members.map((m) => m.h)), padX: median(members.map((m) => m.padX)), padY: median(members.map((m) => m.padY)),
      fontSize: median(members.map((m) => m.fontSize)), weight: mode(members.map((m) => [m.weight, 1])), family: g.item.family, transform: g.item.transform,
      tracking: g.item.tracking, backdrop: g.item.backdrop, shadow: g.item.shadow, ground: mode(members.map((m) => [m.ground, 1])),
      labels: [...new Set(members.map((m) => m.label))].slice(0, 4), inHeader: members.every((m) => m.inHeader),
    };
  }).filter((g) => g.variant !== 'text');
  const byVariant = {};
  for (const g of groups) if (!byVariant[g.variant]) byVariant[g.variant] = g;
  if (!col) return { buttons: groups };

  const cardSig = (c) => [c.fill || 'none', c.backdrop ? 'glass' : '', Math.round(c.radius), c.media, c.border ? 'b' : '', c.shadow ? 's' : ''].join('|');
  const cards = mergeLists(pages.map((p) => p.cards), cardSig).slice(0, 6).map((g) => {
    const members = pages.flatMap((p) => p.cards).filter((c) => cardSig(c) === g.key);
    return { n: g.n, fill: g.item.fill, backdrop: g.item.backdrop, radius: g.item.radius, padding: median(members.map((m) => m.padL)), shadow: g.item.shadow, border: g.item.border, media: g.item.media, w: median(members.map((m) => m.w)), h: median(members.map((m) => m.h)), ground: g.item.ground };
  });
  const inputsAll = pages.flatMap((p) => p.inputs || []);
  let input;
  if (inputsAll.length) {
    const g = mergeLists(pages.map((p) => p.inputs), (i) => [i.h, i.radius, i.borderColor, i.bg].join('|'))[0].item;
    input = { ...g, inferred: false, count: inputsAll.length };
  } else {
    const a = byVariant.filled || groups[0] || { h: 44, radius: 8, padX: 16 };
    input = { h: a.h || 44, radius: a.pill ? a.radius : Math.min(a.radius || 8, 12), padX: a.padX || 16, borderW: 1, borderColor: col.roles.border.hex, bg: col.roles.background.hex, fg: col.roles.text.hex, fontSize: typo.roles.body.size, placeholder: 'Email address', inferred: true, count: 0 };
    assume('No form fields were found; the input is inferred from the primary button and the border colour.');
  }
  const header = pages[0].header;
  return { buttons: groups.slice(0, 8), primary: byVariant, variants: Object.keys(byVariant), cards, input, nav: header };
}

// ---------- imagery ----------
const STOP = new Set('the and for with from that this your our are you a an of to in on at by is it be as or image photo picture logo icon il lo la le gli i un una di da del della dei delle per con su che e ed foto immagine'.split(' '));
function imagery(snapshot, pagesData) {
  const media = mergeLists(pagesData.map((p) => p.media), (m) => m.src + '|' + m.w + '|' + m.h).map((g) => ({ ...g.item, n: g.n, chrome: g.chrome }));
  const fmt = (m) => {
    if (m.kind === 'video') return 'video';
    if (m.kind === 'svg') return 'svg (inline)';
    if (m.kind === 'canvas') return 'canvas';
    if (/^data:/.test(m.src)) return 'data URI';
    const e = (m.src.split('?')[0].match(/\.([a-z0-9]{3,4})$/i) || [])[1];
    if (!e) return 'unknown (CDN)';
    return { jpeg: 'jpg', mp4: 'video', webm: 'video', mov: 'video' }[e.toLowerCase()] || e.toLowerCase();
  };
  const count = (f) => { const m = {}; media.forEach((x) => { const k = f(x); m[k] = (m[k] || 0) + x.n; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const crop = (m) => { const r = m.w / Math.max(1, m.h); return r >= 2.2 ? 'panorama (>2.2:1)' : r >= 1.6 ? 'wide (16:9)' : r >= 1.2 ? 'landscape (3:2, 4:3)' : r >= 0.85 ? 'square (1:1)' : r >= 0.65 ? 'portrait (4:5, 3:4)' : 'tall (9:16)'; };
  const totalN = sum(media, (m) => m.n) || 1;
  const docArea = sum(pagesData, (p) => p.docW * p.docH) || 1;
  const mediaArea = sum(pagesData, (p) => Math.min(sum(p.media, (m) => m.area), p.docW * p.docH));
  const words = {};
  media.forEach((m) => (m.alt || '').toLowerCase().split(/[^a-zà-ÿ0-9]+/).forEach((w) => { if (w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)) words[w] = (words[w] || 0) + 1; }));
  return {
    count: totalN,
    formats: count(fmt), kinds: count((m) => m.kind), crops: count(crop), fits: count((m) => m.fit || 'n/a'),
    fullBleedShare: round(sum(media.filter((m) => m.bleed), (m) => m.n) / totalN, 3),
    areaShare: round(mediaArea / docArea, 3),
    altThemes: Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 12),
    altCoverage: round(media.filter((m) => m.alt).length / (media.length || 1), 3),
    sources: snapshot.pages.map((p) => ({ url: p.url, path: p.path, n: (p.data.media || []).length })),
  };
}

// ---------- voice ----------
const YOU = /\b(you|your|yours|you're|you've|yourself|tu|ti|tuo|tua|tuoi|tue|voi|vostro|vostra|vostri|vous|votre|vos|du|dein|deine|ihr|usted|tú|tus)\b/gi;
const WE = /\b(we|our|ours|we're|we've|us|noi|nostro|nostra|nostri|nostre|nous|notre|nos|wir|unser|unsere|nosotros|nuestro|nuestra)\b/gi;
function voice(snapshot) {
  const heads = [], paras = [], ctas = [];
  const seenH = new Set(), seenP = new Set(), seenC = new Set();
  for (const p of snapshot.pages) {
    for (const h of p.data.headings || []) if (/h[1-3]/.test(h.tag) && !seenH.has(h.text)) { seenH.add(h.text); heads.push({ ...h, url: p.url }); }
    for (const x of p.data.paragraphs || []) if (!seenP.has(x.text)) { seenP.add(x.text); paras.push({ ...x, url: p.url }); }
    for (const c of p.data.ctas || []) if (!seenC.has(c)) { seenC.add(c); ctas.push(c); }
  }
  const wc = (s) => s.split(/\s+/).filter(Boolean).length;
  const quotes = [];
  const usedPages = new Set();
  const pushQ = (text, url, kind) => {
    const t = text.replace(/\s+/g, ' ').trim();
    if (wc(t) < 2 || wc(t) > 15 || quotes.some((q) => q.text === t)) return false;
    quotes.push({ text: t, url, kind });
    usedPages.add(url);
    return true;
  };
  for (const tag of ['h1', 'h2']) for (const h of heads.filter((x) => x.tag === tag)) { if (quotes.length >= 3) break; if (!usedPages.has(h.url) || quotes.length >= snapshot.pages.length) pushQ(h.text, h.url, tag); }
  for (const h of heads) { if (quotes.length >= 4) break; pushQ(h.text, h.url, h.tag); }
  for (const p of paras) {
    if (quotes.length >= 5) break;
    for (const s of p.text.split(/(?<=[.!?])\s+/)) if (wc(s) >= 5 && pushQ(s, p.url, 'p')) break;
  }
  for (const h of heads) { if (quotes.length >= 5) break; pushQ(h.text, h.url, h.tag); }
  for (const c of ctas) { if (quotes.length >= 5) break; pushQ(c, snapshot.pages[0].url, 'cta'); }

  const hTexts = heads.map((h) => h.text);
  const allCopy = [...hTexts, ...paras.map((p) => p.text), ...ctas].join(' \n ');
  const words = wc(allCopy) || 1;
  const hw = hTexts.map(wc);
  const sorted = [...hw].sort((a, b) => a - b);
  const p80 = sorted[Math.floor(sorted.length * 0.8)] || 0;
  const caseOf = (h) => {
    if (h.transform === 'uppercase' || (h.text === h.text.toUpperCase() && /[A-Z]/.test(h.text))) return 'upper';
    const ws = h.text.split(/\s+/).slice(1).filter((w) => w.length >= 4 && /^[A-Za-zÀ-ÿ]/.test(w));
    if (!ws.length) return 'sentence';
    const caps = ws.filter((w) => /^[A-ZÀ-Þ]/.test(w)).length / ws.length;
    return caps >= 0.7 ? 'title' : caps <= 0.3 ? 'sentence' : 'mixed';
  };
  const cases = {};
  heads.forEach((h) => { const c = caseOf(h); cases[c] = (cases[c] || 0) + 1; });
  const nh = heads.length || 1;
  const you = (allCopy.match(YOU) || []).length, we = (allCopy.match(WE) || []).length;
  const lines = [...hTexts, ...paras.map((p) => p.text)];
  const numShare = lines.filter((l) => /\d/.test(l)).length / (lines.length || 1);
  const xy = hTexts.filter((h) => /^[^,]{2,48},\s[^,]{2,48}[.]?$/.test(h)).length / nh;
  const excl = (allCopy.match(/!/g) || []).length;
  const verbs = {};
  ctas.forEach((c) => { const v = c.split(/\s+/)[0].toLowerCase().replace(/[^a-zà-ÿ]/g, ''); if (v) verbs[v] = (verbs[v] || 0) + 1; });
  const topVerbs = Object.entries(verbs).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const stats = {
    headlines: heads.length, paragraphs: paras.length, ctas: ctas.length, words,
    headlineWords: { mean: round(sum(hw) / (hw.length || 1), 1), median: median(hw), p80 },
    case: Object.fromEntries(Object.entries(cases).map(([k, v]) => [k, round(v / nh, 3)])),
    you, we, numberShare: round(numShare, 3), xyShare: round(xy, 3), exclamations: excl,
    exclamationsPer1000: round((excl / words) * 1000, 2), ctaVerbs: topVerbs,
  };
  const pct = (x) => `${Math.round(x * 100)}%`;
  const cand = [];
  cand.push({ score: 10, title: `Keep headlines to about ${Math.max(stats.headlineWords.median, 1)} words`, detail: `Median headline length is ${stats.headlineWords.median} words; 80% are ${p80} words or fewer (${heads.length} headlines).` });
  const topCase = Object.entries(stats.case).sort((a, b) => b[1] - a[1])[0];
  if (topCase) {
    const names = { sentence: 'Use sentence case', title: 'Use title case', upper: 'Set headlines in capitals', mixed: 'Case is mixed; follow the page' };
    cand.push({ score: topCase[1] * 1.5, title: names[topCase[0]], detail: `${pct(topCase[1])} of headlines are ${topCase[0]} case.` });
  }
  if (you + we > 0) {
    const r = you / Math.max(we, 1), r2 = we / Math.max(you, 1);
    if (r >= 1.5) cand.push({ score: Math.min(r / 2, 2), title: 'Address the reader as "you"', detail: `"You" forms appear ${you} times, "we" forms ${we} times.` });
    else if (r2 >= 1.5) cand.push({ score: Math.min(r2 / 2, 2), title: 'Speak as "we"', detail: `"We" forms appear ${we} times, "you" forms ${you} times.` });
    else cand.push({ score: 0.4, title: 'Balance "you" and "we"', detail: `"You" ${you} times, "we" ${we} times.` });
  }
  cand.push({ score: excl === 0 ? 1.2 : stats.exclamationsPer1000 < 1 ? 0.8 : 0.3, title: excl === 0 ? 'No exclamation marks' : stats.exclamationsPer1000 < 1 ? 'Exclamation marks are rare' : 'Exclamation marks are part of the voice', detail: `${excl} exclamation marks in ${words} words (${stats.exclamationsPer1000} per 1,000).` });
  if (topVerbs.length >= 2) cand.push({ score: 0.9, title: 'Start calls to action with a verb', detail: `Most frequent first words in ${ctas.length} CTA labels: ${topVerbs.slice(0, 4).map(([v, n]) => `"${v}" (${n})`).join(', ')}.` });
  if (numShare >= 0.2) cand.push({ score: numShare * 3, title: 'Use concrete numbers', detail: `${pct(numShare)} of headlines and paragraphs contain a figure.` });
  if (xy >= 0.12) cand.push({ score: xy * 4, title: 'Use the "X, Y" construction', detail: `${pct(xy)} of headlines are two short clauses joined by a comma.` });
  const rules = [cand[0], ...cand.slice(1).sort((a, b) => b.score - a.score).slice(0, 2)].map((r, i) => ({ n: i + 1, title: r.title, detail: r.detail }));
  return { quotes: quotes.slice(0, 5), rules, stats };
}

// ---------- brand name ----------
function brandName(snapshot) {
  const d = snapshot.pages[0].data;
  if (d.siteName && d.siteName.length <= 40) return d.siteName.trim();
  const host = new URL(snapshot.meta.url).host.replace(/^www\./, '').split('.')[0].toLowerCase();
  const parts = (d.title || '').split(/\s[|–—·:-]\s|\s\|\s|\|/).map((s) => s.trim()).filter(Boolean);
  const hit = parts.find((p) => { const k = p.toLowerCase().replace(/[^a-z0-9]/g, ''); return k && (host.includes(k) || k.includes(host)); });
  if (hit) return hit;
  return host.charAt(0).toUpperCase() + host.slice(1);
}

// ---------- entry ----------
function analyse(snapshot, runlog) {
  const assume = (t) => runlog && runlog.assume(t);
  const pagesData = snapshot.pages.map((p) => p.data);
  const merged = {};
  for (const k of ['text', 'bg', 'border', 'fill', 'gradients', 'shadows', 'radius', 'containers', 'grids']) merged[k] = mergeMaps(pagesData.map((p) => p[k]));
  merged.spacing = { padding: mergeMaps(pagesData.map((p) => p.spacing.padding)), margin: mergeMaps(pagesData.map((p) => p.spacing.margin)), gap: mergeMaps(pagesData.map((p) => p.spacing.gap)) };
  const allHeadings = pagesData.flatMap((p) => p.headings || []);
  const typo = typography(merged.text, snapshot.mobile ? snapshot.mobile.data.text : {}, allHeadings, assume);
  if (!snapshot.mobile) assume('No 390px pass available; mobile sizes equal desktop sizes.');
  const proto = components(pagesData, typo, null, null, () => {});
  const col = colour(pagesData, merged, proto.buttons, assume);
  const lay = layout(pagesData, merged, pagesData[0], snapshot.css && snapshot.css.breakpoints, assume);
  const comp = components(pagesData, typo, col, lay, assume);
  const img = imagery(snapshot, pagesData);
  const voi = voice(snapshot);

  // motion: declared easing (CSS custom properties first, then the most used curve)
  const rootVars = { ...(snapshot.css ? snapshot.css.rootVars : {}), ...pagesData[0].rootVars };
  const easeVar = Object.entries(rootVars).find(([k, v]) => /ease|easing|motion|curve/i.test(k) && /cubic-bezier|ease/.test(v));
  const easings = mergeMaps(pagesData.map((p) => p.motion.easing));
  const cssEase = snapshot.css ? Object.entries(snapshot.css.easings).sort((a, b) => b[1] - a[1])[0] : null;
  const usedEase = Object.entries(easings).filter(([k]) => /cubic-bezier/.test(k)).sort((a, b) => b[1].n - a[1].n)[0];
  let easing = easeVar ? easeVar[1] : usedEase ? usedEase[0] : cssEase ? cssEase[0] : null;
  if (!easing) { easing = 'cubic-bezier(0.2, 0.7, 0.2, 1)'; assume('No declared easing found; cubic-bezier(0.2, 0.7, 0.2, 1) used for motion.'); }
  const durations = mergeMaps(pagesData.map((p) => p.motion.duration));
  const dur = Object.entries(durations).sort((a, b) => b[1].n - a[1].n)[0];

  const fontsDeclared = [...new Set([...pagesData.flatMap((p) => (p.fonts || []).map((f) => f.family)), ...Object.keys((snapshot.css && snapshot.css.fontFaces) || {})])];
  const typeVars = Object.fromEntries(Object.entries(rootVars).filter(([k]) => /font|text|type|size|leading|line|tracking|heading|display/i.test(k)).slice(0, 40));

  const stats = {
    pages: snapshot.pages.length,
    elements: sum(pagesData, (p) => p.elements) + (snapshot.mobile ? snapshot.mobile.data.elements : 0),
    excluded: sum(pagesData, (p) => p.excluded),
    truncated: pagesData.some((p) => p.truncated),
  };
  const overview = {
    typefaces: typo.families.length,
    colours: col.palette.filter((p) => p.score >= 0.002).length,
    spacingBase: lay.base,
    buttonVariants: comp.variants.length,
  };
  return {
    brand: brandName(snapshot), url: snapshot.meta.url, host: snapshot.meta.host, lang: pagesData[0].lang,
    description: pagesData[0].description, stats, overview,
    typography: { ...typo, fallback: FALLBACK, declaredFonts: fontsDeclared, typeVars },
    colour: col, layout: lay, components: comp, imagery: img, voice: voi,
    motion: { easing, duration: dur ? dur[0] : '0.3s', easings: Object.entries(easings).sort((a, b) => b[1].n - a[1].n).slice(0, 6).map(([k, v]) => [k, v.n]) },
    rootVars, pages: snapshot.pages.map((p) => ({ url: p.url, path: p.path, role: p.role, score: p.score, reasons: p.reasons, elements: p.data.elements })),
  };
}

module.exports = { analyse, mergeMaps, mergeLists, clampExpr };
