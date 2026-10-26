'use strict';
// CSS shared by the guide, the social slides and the video: tokens, type roles,
// rebuilt buttons, media slots (gradient fallbacks + embedded WebP) and badges.
const fs = require('fs');
const path = require('path');
const C = require('./color');
const { ROLES } = require('./tokens');

const SLOTS = ['hero', 'horizon', 'object', 'street', 'sky', 'glass', 'grid', 'tokens', 'detail'];

// Every fallback is composed from colour tokens only.
const FALLBACKS = {
  hero: 'radial-gradient(120% 90% at 82% 8%, color-mix(in oklab, var(--color-accent) 75%, transparent), transparent 62%), radial-gradient(90% 80% at 6% 100%, color-mix(in oklab, var(--color-action-alt) 80%, transparent), transparent 66%), linear-gradient(160deg, var(--color-surface-inverse), color-mix(in oklab, var(--color-surface-inverse) 70%, var(--color-accent)))',
  horizon: 'linear-gradient(180deg, color-mix(in oklab, var(--color-surface-inverse) 92%, var(--color-accent)) 0%, color-mix(in oklab, var(--color-accent) 45%, var(--color-surface-inverse)) 58%, color-mix(in oklab, var(--color-accent) 60%, var(--color-background)) 61%, var(--color-surface-inverse) 100%)',
  object: 'radial-gradient(38% 34% at 50% 46%, var(--color-accent), color-mix(in oklab, var(--color-accent) 40%, var(--color-surface-inverse)) 55%, var(--color-surface-inverse) 100%)',
  street: 'linear-gradient(135deg, var(--color-surface) 0%, color-mix(in oklab, var(--color-text-muted) 55%, var(--color-surface)) 60%, var(--color-text) 100%)',
  sky: 'linear-gradient(180deg, color-mix(in oklab, var(--color-accent) 28%, var(--color-background)) 0%, var(--color-background) 85%)',
  glass: 'conic-gradient(from 210deg at 62% 38%, var(--color-surface-inverse), color-mix(in oklab, var(--color-action-alt) 70%, var(--color-surface-inverse)), color-mix(in oklab, var(--color-accent) 70%, var(--color-background)), var(--color-surface-inverse))',
  grid: 'repeating-linear-gradient(90deg, transparent 0 46px, color-mix(in oklab, var(--color-text) 14%, transparent) 46px 48px), repeating-linear-gradient(0deg, transparent 0 46px, color-mix(in oklab, var(--color-text) 14%, transparent) 46px 48px), var(--color-surface)',
  tokens: 'var(--gradient-brand), var(--color-surface-inverse)',
  detail: 'radial-gradient(70% 60% at 30% 30%, color-mix(in oklab, var(--color-accent) 35%, var(--color-surface)), var(--color-surface) 70%)',
};

function imageCss(manifest, imagesDir) {
  if (!manifest) return '';
  const out = [];
  for (const slot of SLOTS) {
    const m = manifest.slots[slot];
    if (!m || !m.webp) continue;
    const b64 = fs.readFileSync(path.join(imagesDir, m.webp)).toString('base64');
    out.push(`.i-${slot}{background-image:url(data:image/webp;base64,${b64})}`);
  }
  return out.join('\n');
}

function roleCss() {
  return ROLES.map((r) => `.t-${r}{font-family:var(--type-${r}-family);font-size:var(--type-${r}-size);line-height:var(--type-${r}-line-height);font-weight:var(--type-${r}-weight);letter-spacing:var(--type-${r}-tracking);text-transform:var(--type-${r}-transform)}`).join('\n');
}

function variantCss(a) {
  const css = [];
  a.components.buttons.slice(0, 6).forEach((b, i) => {
    const n = i + 1;
    css.push(`.bv-${n}{background:var(--button-v${n}-bg);color:var(--button-v${n}-fg);border:var(--button-v${n}-border);border-radius:var(--button-v${n}-radius);min-height:var(--button-v${n}-height);padding:0 var(--button-v${n}-padding-x)${b.backdrop ? ';backdrop-filter:var(--button-translucent-backdrop);-webkit-backdrop-filter:var(--button-translucent-backdrop)' : ''}}`);
  });
  a.components.cards.slice(0, 4).forEach((c, i) => {
    const n = i + 1;
    css.push(`.cv-${n}{background:var(--card-v${n}-bg);border-radius:var(--card-v${n}-radius);box-shadow:var(--card-v${n}-shadow);border:var(--card-v${n}-border);backdrop-filter:var(--card-v${n}-backdrop);-webkit-backdrop-filter:var(--card-v${n}-backdrop)}`);
  });
  return css.join('\n');
}

// Pick the brand's own button for each ground, by measured usage and legibility.
function groundButtons(a) {
  const bg = a.colour.roles.background.hex, inv = a.colour.roles['surface-inverse'].hex;
  const V = a.components.buttons.slice(0, 6).map((b, i) => ({ ...b, n: i + 1 }));
  const tone = (g) => (g && g !== 'image' && C.isDark(g) ? 'dark' : g === 'image' ? 'image' : 'light');
  const legible = (v, g) => v.bg && C.contrast(C.over(v.bg, g), g) >= 1.25;
  const lv = V.find((v) => v.variant === 'filled' && tone(v.ground) === 'light' && legible(v, bg));
  const light = C.contrast(a.colour.roles.action.hex, bg) >= 1.25 ? 'btn' : lv ? `btn bv-${lv.n}` : 'btn btn-outline';
  const dv = V.find((v) => v.variant === 'filled' && tone(v.ground) !== 'light' && legible(v, inv)) || V.find((v) => v.variant === 'translucent');
  const dark = dv ? `btn bv-${dv.n}` : C.contrast(a.colour.roles.action.hex, inv) >= 1.25 ? 'btn' : 'btn btn-glass';
  return { light, dark };
}

function baseCss(a, tokensCss, manifest, imagesDir) {
  const fallbacks = SLOTS.map((s) => `.f-${s}{background:${FALLBACKS[s]};background-size:cover;background-position:center}`).join('\n');
  return `${tokensCss}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:var(--color-background);color:var(--color-text);font-family:var(--type-body-family);font-size:var(--type-body-size);line-height:var(--type-body-line-height);font-weight:var(--type-body-weight);letter-spacing:var(--type-body-tracking);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
h1,h2,h3,h4,p,figure,blockquote,pre,dl,dd,ul,ol{margin:0}
ul,ol{padding:0;list-style:none}
a{color:inherit}
${roleCss()}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5em;min-height:var(--button-height);padding:var(--button-padding-y) var(--button-padding-x);border-radius:var(--button-radius);border:0;background:var(--button-bg);color:var(--button-fg);font-family:var(--type-body-family);font-size:var(--button-font-size);font-weight:var(--button-font-weight);letter-spacing:var(--button-tracking);text-transform:var(--button-transform);line-height:1.1;text-decoration:none;cursor:pointer;white-space:nowrap;transition:transform var(--motion-duration) var(--motion-easing),filter var(--motion-duration) var(--motion-easing),background-color var(--motion-duration) var(--motion-easing)}
.btn:hover{filter:brightness(1.07)}.btn:active{transform:scale(.98)}
.btn:focus-visible{outline:2px solid var(--color-accent);outline-offset:3px}
.btn.pill{border-radius:var(--radius-pill)}
.btn-outline{background:transparent;color:var(--button-outline-fg);box-shadow:inset 0 0 0 var(--button-outline-border-width) var(--button-outline-border)}
.dark .btn-outline,.on-image .btn-outline{color:var(--color-text-inverse);box-shadow:inset 0 0 0 var(--button-outline-border-width) color-mix(in srgb,var(--color-text-inverse) 70%,transparent)}
.btn-glass{background:var(--button-translucent-bg);color:var(--button-translucent-fg);backdrop-filter:var(--button-translucent-backdrop);-webkit-backdrop-filter:var(--button-translucent-backdrop)}
${variantCss(a)}
.media{position:relative;overflow:hidden;background:var(--color-surface-inverse);isolation:isolate}
.media>.ph{position:absolute;inset:0;background-size:cover;background-position:center;transform:scale(1.001);transition:transform 1.8s var(--motion-easing)}
.zoom:hover>.ph,.zoom:hover .media>.ph{transform:scale(1.07)}
${fallbacks}
${imageCss(manifest, imagesDir)}
.ai-label{position:absolute;z-index:3;right:12px;bottom:12px;font:600 11px/1 var(--type-body-family);letter-spacing:.02em;padding:6px 9px;border-radius:999px;background:color-mix(in srgb,var(--color-surface-inverse) 72%,transparent);color:var(--color-text-inverse);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none}
.unofficial{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;font:600 12px/1.2 var(--type-body-family);letter-spacing:.02em;border:1px solid currentColor;white-space:nowrap}
.unofficial::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.logo-ph{display:inline-grid;place-items:center;width:var(--nav-logo-width);height:var(--nav-logo-height);border:1.5px dashed var(--nav-logo-color);border-radius:4px;color:var(--nav-logo-color);background:color-mix(in srgb,var(--color-background) 55%,transparent);font:600 9px/1 var(--type-body-family);letter-spacing:.04em;text-transform:uppercase;text-decoration:none;flex:none;overflow:hidden}
.scrim{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,color-mix(in srgb,var(--color-surface-inverse) 45%,transparent) 0%,transparent 30%,transparent 45%,color-mix(in srgb,var(--color-surface-inverse) 80%,transparent) 100%);pointer-events:none}
`;
}

function slot(name, manifest, extra = '', style = '') {
  const has = manifest && manifest.slots[name] && manifest.slots[name].webp;
  return `<div class="media ${extra}"${style ? ` style="${style}"` : ''} data-slot="${name}"${has ? ' data-ai="1" role="img" aria-label="AI-generated image"' : ' aria-hidden="true"'}><div class="ph f-${name}${has ? ' i-' + name : ''}"></div>${has ? '<span class="ai-label">AI-generated image</span>' : ''}</div>`;
}

module.exports = { baseCss, slot, SLOTS, groundButtons };
