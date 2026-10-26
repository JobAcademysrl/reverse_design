'use strict';
const C = require('./color');
const { round } = require('./util');

const ROLES = ['display', 'h1', 'h2', 'h3', 'h4', 'lead', 'body', 'small'];
const COLOR_ROLES = ['background', 'surface', 'surface-inverse', 'text', 'text-muted', 'text-inverse', 'action', 'on-action', 'action-alt', 'accent', 'border'];
const pxv = (n) => `${round(n, 2)}px`;
const quote = (f) => (/^[a-z-]+$/i.test(f) && !/\s/.test(f) && /^(system-ui|sans-serif|serif|monospace|ui-\w+)$/.test(f) ? f : `"${f}"`);

function buildTokens(a) {
  const T = a.typography, R = a.colour.roles, L = a.layout, K = a.components;
  const v = {}; // css var name -> { value, type, group, meta }
  const set = (name, value, type, meta) => { v[name] = { value: String(value), type, meta: meta || {} }; };

  // fonts
  const fam = (role) => T.roles[role].family;
  const stack = (f) => `${quote(f)}, ${T.fallback[T.families.find((x) => x.family === f)?.generic || 'sans-serif']}`;
  set('--font-display', stack(fam('display')), 'fontFamily', { family: fam('display') });
  set('--font-heading', stack(fam('h1')), 'fontFamily', { family: fam('h1') });
  set('--font-body', stack(fam('body')), 'fontFamily', { family: fam('body') });

  // type roles
  for (const r of ROLES) {
    const t = T.roles[r];
    const famVar = r === 'display' ? 'var(--font-display)' : /^h\d$/.test(r) ? 'var(--font-heading)' : 'var(--font-body)';
    const meta = { inferred: t.inferred, share: t.share, mobilePx: t.mobile, desktopPx: t.size };
    set(`--type-${r}-family`, famVar, 'fontFamily', meta);
    set(`--type-${r}-size`, t.clamp, 'dimension', meta);
    set(`--type-${r}-size-desktop`, pxv(t.size), 'dimension', meta);
    set(`--type-${r}-size-mobile`, pxv(t.mobile), 'dimension', meta);
    set(`--type-${r}-line-height`, round(t.lhRatio, 3), 'number', meta);
    set(`--type-${r}-weight`, t.weight, 'fontWeight', meta);
    set(`--type-${r}-tracking`, `${round(t.trackingEm, 3)}em`, 'dimension', meta);
    set(`--type-${r}-transform`, t.transform || 'none', 'string', meta);
  }

  // colour roles
  for (const r of COLOR_ROLES) set(`--color-${r}`, R[r].hex, 'color', { oklch: R[r].oklch, share: R[r].share, source: R[r].source, inferred: R[r].inferred });
  set('--gradient-brand', a.colour.brandGradient.css, 'gradient', { inferred: a.colour.brandGradient.inferred });

  // spacing and layout
  set('--space-base', pxv(L.base), 'dimension');
  L.scale.forEach((s, i) => set(`--space-${i + 1}`, pxv(s), 'dimension'));
  set('--layout-container', pxv(L.container), 'dimension');
  set('--layout-columns', L.columns, 'number', { inferred: L.columnsInferred });
  set('--layout-gutter', pxv(L.gutter), 'dimension');
  L.breakpoints.forEach((b, i) => set(`--layout-bp-${i + 1}`, pxv(b.v), 'dimension', { types: b.types }));

  // radii
  const rs = L.radii.scale.length ? L.radii.scale : [{ v: 8 }];
  ['sm', 'md', 'lg', 'xl'].forEach((n, i) => { if (rs[i]) set(`--radius-${n}`, pxv(rs[i].v), 'dimension'); });
  set('--radius-pill', '999px', 'dimension', { share: L.radii.pillShare });

  // buttons
  const P = K.primary;
  const ground = R.background.hex;
  const fill = P.filled ? R.action.hex : R['surface-inverse'].hex;
  const btn = P.filled || K.buttons[0] || { h: 44, padX: 20, padY: 10, fontSize: T.roles.body.size, weight: 500, radius: 8, pill: false, tracking: 0, transform: 'none' };
  const radiusOf = (b) => (b.pill ? '999px' : pxv(b.radius || 0));
  set('--button-bg', fill, 'color', { inferred: !P.filled });
  set('--button-fg', R['on-action'].hex, 'color');
  set('--button-radius', radiusOf(btn), 'dimension');
  set('--button-height', pxv(btn.h), 'dimension');
  set('--button-padding-x', pxv(btn.padX), 'dimension');
  set('--button-padding-y', pxv(btn.padY), 'dimension');
  set('--button-font-size', pxv(btn.fontSize || T.roles.body.size), 'dimension');
  set('--button-font-weight', btn.weight || 500, 'fontWeight');
  set('--button-tracking', `${round((btn.tracking || 0) / (btn.fontSize || 16), 3)}em`, 'dimension');
  set('--button-transform', btn.transform || 'none', 'string');
  const out = P.outline;
  set('--button-outline-border', out ? C.over(out.borderColor || out.fg || R.text.hex, ground) : R.text.hex, 'color', { inferred: !out });
  set('--button-outline-fg', out ? C.over(out.fg || R.text.hex, ground) : R.text.hex, 'color', { inferred: !out });
  set('--button-outline-border-width', pxv(out ? out.borderW : 1), 'dimension', { inferred: !out });
  const tr = P.translucent;
  set('--button-translucent-bg', tr && tr.bg ? tr.bg : '#ffffff29', 'color', { inferred: !tr });
  set('--button-translucent-fg', tr && tr.fg ? tr.fg : '#ffffff', 'color', { inferred: !tr });
  set('--button-translucent-backdrop', tr && tr.backdrop ? tr.backdrop : 'blur(12px)', 'string', { inferred: !(tr && tr.backdrop) });
  K.buttons.slice(0, 6).forEach((b, i) => {
    const n = i + 1;
    set(`--button-v${n}-bg`, b.bg || 'transparent', 'color', { variant: b.variant, labels: b.labels });
    set(`--button-v${n}-fg`, b.fg || R.text.hex, 'color');
    set(`--button-v${n}-border`, b.borderW ? `${pxv(b.borderW)} solid ${b.borderColor}` : 'none', 'string');
    set(`--button-v${n}-radius`, radiusOf(b), 'dimension');
    set(`--button-v${n}-height`, pxv(b.h), 'dimension');
    set(`--button-v${n}-padding-x`, pxv(b.padX), 'dimension');
    set(`--button-v${n}-ground`, b.ground && b.ground !== 'image' ? b.ground : R['surface-inverse'].hex, 'color');
  });

  // cards
  const cards = K.cards;
  const card = cards[0] || {};
  const padded = cards.find((c) => c.padding > 0);
  set('--card-bg', card.fill ? C.over(card.fill, ground) : R.surface.hex, 'color', { inferred: !card.fill });
  set('--card-radius', pxv(card.radius || (rs[rs.length - 1] || {}).v || 16), 'dimension');
  set('--card-padding', pxv(padded ? padded.padding : L.scale.find((s) => s >= 20) || 24), 'dimension', { inferred: !padded });
  set('--card-shadow', card.shadow || 'none', 'shadow');
  const glass = cards.find((c) => c.backdrop);
  set('--card-backdrop', glass ? glass.backdrop : 'blur(24px) saturate(1.4)', 'string', { inferred: !glass });
  set('--card-glass-bg', glass && glass.fill ? glass.fill : C.isDark(ground) ? '#ffffff1f' : '#ffffff8c', 'color', { inferred: !(glass && glass.fill) });
  set('--card-border', card.border ? `1px solid ${card.border}` : 'none', 'string');

  cards.slice(0, 4).forEach((c, i) => {
    const n = i + 1;
    set(`--card-v${n}-bg`, c.fill ? C.over(c.fill, c.ground && c.ground !== 'image' ? c.ground : ground) : 'transparent', 'color', { media: c.media });
    set(`--card-v${n}-radius`, pxv(c.radius), 'dimension');
    set(`--card-v${n}-padding`, pxv(c.padding), 'dimension');
    set(`--card-v${n}-shadow`, c.shadow || 'none', 'shadow');
    set(`--card-v${n}-backdrop`, c.backdrop || 'none', 'string');
    set(`--card-v${n}-border`, c.border ? `1px solid ${c.border}` : 'none', 'string');
    set(`--card-v${n}-ground`, c.ground && c.ground !== 'image' ? c.ground : R['surface-inverse'].hex, 'color');
  });

  // input
  const I = K.input;
  set('--input-height', pxv(I.h), 'dimension', { inferred: I.inferred });
  set('--input-radius', pxv(I.radius), 'dimension', { inferred: I.inferred });
  set('--input-padding-x', pxv(I.padX), 'dimension', { inferred: I.inferred });
  set('--input-border-width', pxv(I.borderW || 1), 'dimension', { inferred: I.inferred });
  set('--input-border', I.borderColor ? C.over(I.borderColor, ground) : R.border.hex, 'color', { inferred: I.inferred });
  set('--input-bg', I.bg ? C.over(I.bg, ground) : ground, 'color', { inferred: I.inferred });
  set('--input-fg', I.fg || R.text.hex, 'color', { inferred: I.inferred });
  set('--input-font-size', pxv(I.fontSize || T.roles.body.size), 'dimension', { inferred: I.inferred });

  // nav
  const N = K.nav || {};
  const linkKey = N.linkStyles ? Object.entries(N.linkStyles).sort((a, b) => b[1].n - a[1].n)[0] : null;
  const [lSize, lWeight, lColor, lTransform] = linkKey ? linkKey[0].split('|') : [T.roles.small.size, 500, R.text.hex, 'none'];
  set('--nav-height', pxv(N.h || 64), 'dimension', { inferred: !N.h });
  set('--nav-bg', N.bg || 'transparent', 'color');
  set('--nav-backdrop', N.backdrop || 'none', 'string');
  set('--nav-sticky', N.sticky ? 'sticky' : 'static', 'string');
  set('--nav-link-size', pxv(+lSize), 'dimension');
  set('--nav-link-weight', lWeight, 'fontWeight');
  set('--nav-link-color', lColor && lColor !== 'null' ? lColor : R.text.hex, 'color');
  set('--nav-link-transform', lTransform || 'none', 'string');
  set('--nav-logo-width', pxv((N.logo && N.logo.w) || 120), 'dimension', { inferred: !N.logo });
  set('--nav-logo-height', pxv((N.logo && N.logo.h) || 28), 'dimension', { inferred: !N.logo });
  set('--nav-logo-color', (N.logo && N.logo.color) || R.text.hex, 'color', { inferred: !(N.logo && N.logo.color) });

  // motion
  set('--motion-easing', a.motion.easing, 'cubicBezier');
  set('--motion-duration', a.motion.duration, 'duration');

  return { vars: v, css: toCss(a, v), json: toJson(a, v) };
}

function toCss(a, v) {
  const lines = [
    `/* ${a.brand} design tokens. Unofficial analysis of ${a.url}.`,
    ` * Not affiliated with or endorsed by ${a.brand}. Trademarks belong to their owners.`,
    ` * Generated by reverse-brand from measured computed styles. */`,
    ':root {',
  ];
  let group = '';
  for (const [k, t] of Object.entries(v)) {
    const g = k.split('-')[2];
    if (g !== group) { group = g; }
    const note = t.meta.oklch ? ` /* ${t.meta.oklch}${t.meta.inferred ? ', inferred' : ''} */` : t.meta.inferred ? ' /* inferred */' : '';
    lines.push(`  ${k}: ${t.value};${note}`);
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

const DTCG = { color: 'color', dimension: 'dimension', fontFamily: 'fontFamily', fontWeight: 'fontWeight', number: 'number', duration: 'duration', cubicBezier: 'cubicBezier', shadow: 'shadow', gradient: 'gradient', string: 'string' };

function toJson(a, v) {
  const root = {
    $description: `Unofficial analysis of ${a.url}. Not affiliated with or endorsed by ${a.brand}. Trademarks belong to their owners.`,
    $extensions: { 'org.reverse-brand': { generatedAt: new Date().toISOString(), source: a.url } },
  };
  for (const [k, t] of Object.entries(v)) {
    const parts = k.replace(/^--/, '').split('-');
    let node = root;
    // group by first segment, then role (type-h1-size -> type.h1.size)
    const path = parts[0] === 'color' ? ['color', parts.slice(1).join('-')]
      : parts[0] === 'type' ? ['type', parts[1], parts.slice(2).join('-')]
      : [parts[0], parts.slice(1).join('-') || 'value'];
    for (const p of path.slice(0, -1)) node = node[p] = node[p] || {};
    let value = t.value;
    if (t.type === 'fontFamily' && !/^var\(/.test(value)) value = value.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
    if (t.type === 'cubicBezier') { const m = value.match(/cubic-bezier\(([^)]+)\)/); value = m ? m[1].split(',').map(Number) : value; }
    if (/^var\(--/.test(value)) value = `{${value.slice(6, -1).replace(/^font-/, 'font.')}}`;
    const leaf = { $type: DTCG[t.type] || 'string', $value: value };
    const ext = {};
    if (t.meta.oklch) ext.oklch = t.meta.oklch;
    for (const m of ['inferred', 'variant']) if (t.meta[m] !== undefined && t.meta[m] !== false) ext[m] = t.meta[m];
    if (/-size$/.test(k) && /clamp/.test(t.value)) ext.clamp = t.value;
    if (Object.keys(ext).length) leaf.$extensions = { 'org.reverse-brand': ext };
    node[path[path.length - 1]] = leaf;
  }
  return root;
}

module.exports = { buildTokens, ROLES, COLOR_ROLES };
