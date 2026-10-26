'use strict';
// Social exports: Instagram carousel (8 × 1080×1350) and X images (4 × 1600×900).
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { launch } = require('./browser');
const { baseCss, slot } = require('./styles');
const { esc, ensureDir, writeJSON, round } = require('./util');
const { COLOR_ROLES } = require('./tokens');

const css = `
body{margin:0;background:#777}
.slide{position:relative;overflow:hidden;display:flex;flex-direction:column;background:var(--color-background);color:var(--color-text);font-size:24px;line-height:1.4}
.ig{width:1080px;height:1350px}.x{width:1600px;height:900px}
.slide.dark{background:var(--color-surface-inverse);color:var(--color-text-inverse)}
.slide .unofficial{position:absolute;z-index:5;top:40px;left:48px;font-size:20px;padding:10px 18px;background:color-mix(in srgb,var(--color-background) 86%,transparent);color:var(--color-text);border-color:transparent}
.slide .ai-label{font-size:16px;padding:8px 12px;right:24px;bottom:24px}
.pad{padding:56px 64px}
.k{font:600 20px/1.3 var(--type-body-family);letter-spacing:.08em;text-transform:uppercase;opacity:.7}
.h-display{font-family:var(--type-display-family);font-weight:var(--type-display-weight);letter-spacing:var(--type-display-tracking);line-height:var(--type-display-line-height);font-size:min(var(--type-display-size-desktop),112px);text-transform:var(--type-display-transform)}
.h-1{font-family:var(--type-h1-family);font-weight:var(--type-h1-weight);letter-spacing:var(--type-h1-tracking);line-height:var(--type-h1-line-height);font-size:min(var(--type-h1-size-desktop),84px)}
.h-2{font-family:var(--type-h2-family);font-weight:var(--type-h2-weight);letter-spacing:var(--type-h2-tracking);line-height:var(--type-h2-line-height);font-size:min(var(--type-h2-size-desktop),60px)}
.lead{font-family:var(--type-lead-family);font-weight:var(--type-lead-weight);line-height:var(--type-lead-line-height);font-size:var(--type-lead-size-desktop)}
.muted{opacity:.72}
.img{flex:none}
.sw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.sw-grid div{display:grid;gap:6px;font-size:18px}
.sw-grid i{display:block;height:120px;border-radius:calc(var(--card-radius) * .6);box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 18%,transparent)}
.pbar{display:flex;height:80px;border-radius:var(--card-radius);overflow:hidden}
.cols{display:grid;grid-template-columns:repeat(var(--layout-columns),1fr);gap:12px;height:220px}
.cols i{background:color-mix(in srgb,var(--color-accent) 25%,transparent);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--color-accent) 55%,transparent);border-radius:6px}
.stair{display:flex;align-items:flex-end;gap:14px}
.stair i{display:block;background:var(--color-accent);border-radius:3px}
.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.facts b{display:block;font-family:var(--type-display-family);font-weight:var(--type-display-weight);font-size:72px;line-height:1;letter-spacing:var(--type-display-tracking)}
.btns{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
.gr{display:grid;place-items:center;height:170px;border-radius:var(--card-radius)}
.gr .btn{font-size:22px}
.quote{font-family:var(--type-h2-family);font-weight:var(--type-h2-weight);font-size:52px;line-height:1.12;letter-spacing:var(--type-h2-tracking)}
.rules{display:grid;gap:18px}
.rules div{display:grid;grid-template-columns:70px 1fr;gap:12px;padding:22px;border-radius:var(--card-radius);background:var(--color-surface)}
.rules b{font-family:var(--type-display-family);font-size:44px;line-height:1;color:var(--color-accent)}
pre{margin:0;font:16px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;padding:28px;border-radius:var(--card-radius);background:color-mix(in srgb,var(--color-text-inverse) 8%,transparent);overflow:hidden}
.foot{margin-top:auto;font-size:18px;opacity:.75}
.radii{display:grid;grid-template-columns:repeat(5,1fr);gap:18px;font-size:18px;align-items:end}
.radii div{display:grid;gap:8px}
.radii i{display:block;height:150px;background:var(--color-surface-inverse)}
.spec{display:flex;gap:28px;font-size:20px;flex-wrap:wrap}
`;

function slidesHtml(a, tokens, manifest, imagesDir) {
  const T = a.typography, R = a.colour.roles, L = a.layout, K = a.components, V = a.voice;
  const S = (n, style = '') => slot(n, manifest, 'img', style);
  const B = esc(a.brand);
  const badge = '<span class="unofficial">Unofficial analysis</span>';
  const disc = `Not affiliated with or endorsed by ${B}. Trademarks belong to their owners.`;
  const pal = a.colour.palette.slice(0, 10);
  const ps = pal.reduce((s, p) => s + p.score, 0) || 1;
  const palBar = `<div class="pbar">${pal.map((p) => `<span style="background:${p.hex};flex-grow:${round(p.score / ps, 4)}"></span>`).join('')}</div>`;
  const roles6 = ['background', 'surface-inverse', 'text', 'action', 'action-alt', 'accent'];
  const swatches = roles6.map((r) => `<div><i style="background:var(--color-${r})"></i><b>${r}</b><span class="muted">${R[r].hex}</span></div>`).join('');
  const btns = K.buttons.slice(0, 4).map((b, i) => `<div class="gr" style="background:var(--button-v${i + 1}-ground)"><span class="btn bv-${i + 1}">${esc(b.labels[0] || 'Button')}</span></div>`).join('');
  const r = (role) => T.roles[role];
  const css2 = tokens.css.split('\n').filter((l) => /--(color|type-h1|space-[1-4]|radius|button-(bg|fg|radius))/.test(l)).slice(0, 26).join('\n');

  const ig = [
    ['cover', `<section class="slide ig dark">${badge}${S('hero', 'height:760px')}<div class="pad" style="display:grid;gap:24px;flex:1"><span class="k">Unofficial brand guidelines</span><h1 class="h-display">${B}</h1><p class="lead muted">Typography, colour, layout, components and voice, measured from ${esc(a.host)}.</p><p class="foot">${disc}</p></div></section>`],
    ['typography', `<section class="slide ig">${badge}${S('horizon', 'height:420px')}<div class="pad" style="display:grid;gap:26px;flex:1;align-content:start"><span class="k">Typography · ${esc(r('display').family)}</span><div class="h-display">Aa ${esc(a.brand.split(' ')[0])}</div><div class="h-2">Heading ${r('h1').size}px / ${r('h1').weight}</div><p class="lead">Lead ${r('lead').size}px, leading ${r('lead').lhRatio}</p><p>Body ${r('body').size}px, weight ${r('body').weight}, leading ${r('body').lhRatio}. Scale ratio ${T.ratio} (${T.interval.name}).</p></div></section>`],
    ['colour', `<section class="slide ig dark">${badge}<div class="pad" style="display:grid;gap:34px;padding-top:130px"><span class="k">Colour</span><h2 class="h-1">${a.colour.palette.length} colours, ${COLOR_ROLES.length} roles</h2>${palBar}<div class="sw-grid">${swatches}</div><div style="height:90px;border-radius:var(--card-radius);background:var(--gradient-brand),var(--color-surface-inverse)"></div></div></section>`],
    ['layout', `<section class="slide ig">${badge}<div class="pad" style="display:grid;gap:40px;padding-top:130px"><span class="k">Layout and spacing</span><div class="facts"><div><b>${L.base}</b>px base</div><div><b>${L.columns}</b>columns</div><div><b>${Math.round(L.gutter)}</b>px gutter</div><div><b>${Math.round(L.container)}</b>px container</div></div><div class="cols">${Array.from({ length: L.columns }, () => '<i></i>').join('')}</div><div class="stair">${L.scale.slice(0, 10).map((v, i) => `<i style="width:var(--space-${i + 1});height:var(--space-${i + 1});max-width:120px;max-height:120px"></i>`).join('')}</div><p class="muted">${Math.round(L.baseShare * 100)}% of spacing values sit on the ${L.base}px grid.</p><div class="radii">${['sm', 'md', 'lg', 'xl'].filter((n) => tokens.vars[`--radius-${n}`]).map((n) => `<div><i style="border-radius:var(--radius-${n})"></i>${tokens.vars[`--radius-${n}`].value}</div>`).join('')}<div><i style="border-radius:var(--radius-pill);height:90px"></i>pill</div></div></div></section>`],
    ['components', `<section class="slide ig dark">${badge}${S('glass', 'height:380px')}<div class="pad" style="display:grid;gap:28px"><span class="k">Components</span><h2 class="h-2">${K.buttons.length} button styles on their grounds</h2><div class="btns">${btns}</div></div></section>`],
    ['voice', `<section class="slide ig">${badge}<div class="pad" style="display:grid;gap:30px;padding-top:130px"><span class="k">Voice and tone</span>${V.quotes.slice(0, 2).map((q) => `<p class="quote">“${esc(q.text)}”</p>`).join('')}<div class="rules">${V.rules.map((x) => `<div><b>${x.n}</b><span><strong>${esc(x.title)}</strong><br><span class="muted" style="font-size:19px">${esc(x.detail)}</span></span></div>`).join('')}</div></div></section>`],
    ['tokens', `<section class="slide ig dark">${badge}<div class="pad" style="display:grid;gap:28px;padding-top:130px"><span class="k">Design tokens</span><h2 class="h-1">${Object.keys(tokens.vars).length} variables</h2><p class="lead muted">CSS custom properties and W3C design-tokens JSON, OKLCH next to hex.</p><pre>${esc(css2)}</pre></div></section>`],
    ['outro', `<section class="slide ig" style="background:var(--gradient-brand),var(--color-surface-inverse);color:var(--color-text-inverse)">${badge}<div class="pad" style="display:grid;gap:30px;flex:1;align-content:end"><span class="k">Unofficial analysis</span><h2 class="h-display">${B} brand guidelines</h2><p class="lead">Measured from ${a.stats.pages} pages and ${a.stats.elements.toLocaleString('en')} elements.</p><p class="foot">${disc} Source: ${esc(a.host)}</p></div></section>`],
  ];
  const x = [
    ['cover', `<section class="slide x dark" style="flex-direction:row">${badge}${S('hero', 'width:820px;height:100%')}<div class="pad" style="display:grid;gap:24px;align-content:center;flex:1"><span class="k">Unofficial brand guidelines</span><h1 class="h-1">${B}</h1><p class="muted">Measured from ${esc(a.host)}.</p><p class="foot" style="margin-top:20px">${disc}</p></div></section>`],
    ['typography', `<section class="slide x" style="flex-direction:row">${badge}${S('horizon', 'width:560px;height:100%')}<div class="pad" style="display:grid;gap:22px;align-content:center;flex:1"><span class="k">Typography</span><div class="h-display">Aa</div><div class="spec"><span>${esc(r('display').family)}</span><span>Display ${r('display').size}px</span><span>Body ${r('body').size}px</span><span>Ratio ${T.ratio}</span></div></div></section>`],
    ['colour', `<section class="slide x dark">${badge}<div class="pad" style="display:grid;gap:30px;padding-top:120px"><span class="k">Colour</span>${palBar}<div class="sw-grid" style="grid-template-columns:repeat(6,1fr)">${swatches}</div></div></section>`],
    ['components', `<section class="slide x dark" style="flex-direction:row">${badge}<div class="pad" style="display:grid;gap:24px;align-content:center;flex:1;padding-top:110px"><span class="k">Components</span><div class="btns">${btns}</div></div>${S('glass', 'width:520px;height:100%')}</section>`],
  ];
  const body = [...ig.map(([n, h]) => h.replace('<section ', `<section data-name="ig-${ig.findIndex((s) => s[0] === n) + 1}-${n}" data-kind="instagram" `)),
    ...x.map(([n, h], i) => h.replace('<section ', `<section data-name="x-${i + 1}-${n}" data-kind="x" `))].join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(a, tokens.css, manifest, imagesDir)}${css}</style></head><body>${body}</body></html>`;
}

async function renderSlides({ a, tokens, manifest, imagesDir, dir }) {
  const out = ensureDir(path.join(dir, 'slides'));
  const htmlPath = path.join(out, 'slides.html');
  fs.writeFileSync(htmlPath, slidesHtml(a, tokens, manifest, imagesDir));
  const { browser } = await launch();
  const list = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    for (const el of await page.$$('section.slide')) {
      const info = await el.evaluate((s) => ({ name: s.dataset.name, kind: s.dataset.kind, badge: /Unofficial analysis/.test(s.querySelector('.unofficial')?.textContent || ''), photo: !!s.querySelector('[data-ai]'), aiCredit: s.querySelectorAll('[data-ai]').length === s.querySelectorAll('[data-ai] > .ai-label').length }));
      const file = path.join(out, `${info.name}.png`);
      await el.screenshot({ path: file });
      list.push({ ...info, file: path.basename(file) });
    }
  } finally { await browser.close(); }
  fs.unlinkSync(htmlPath);
  writeJSON(path.join(out, 'slides.json'), { slides: list });
  return list;
}

module.exports = { renderSlides };
