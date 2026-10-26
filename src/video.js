'use strict';
// 1920×1080 presentation at a real 60 fps, rendered frame-accurately:
// every animation stays paused and is seeked to i/fps before each capture.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { launch } = require('./browser');
const { baseCss, slot } = require('./styles');
const { esc, ensureDir, round, log, hostOf } = require('./util');
const { COLOR_ROLES } = require('./tokens');

const FPS = 60;
const SCENE = 4.2;   // seconds each scene holds
const FADE = 0.7;    // cross-dissolve overlap

const css = `
html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:var(--color-surface-inverse)}
.scene{position:absolute;inset:0;overflow:hidden;display:flex;background:var(--color-background);color:var(--color-text);opacity:0;will-change:opacity,transform,filter}
.scene.dark{background:var(--color-surface-inverse);color:var(--color-text-inverse)}
.scene>.media{position:absolute;inset:0}
.in{position:relative;z-index:2;padding:110px 140px;display:flex;flex-direction:column;justify-content:center;gap:34px;width:100%}
.badge{position:fixed;z-index:20;left:56px;bottom:44px;font-size:20px;padding:10px 18px;color:var(--color-text-inverse);background:color-mix(in srgb,var(--color-surface-inverse) 55%,transparent);border-color:transparent;backdrop-filter:blur(8px)}
.k{font:600 24px/1.3 var(--type-body-family);letter-spacing:.08em;text-transform:uppercase;opacity:.72}
.hd{font-family:var(--type-display-family);font-weight:var(--type-display-weight);letter-spacing:var(--type-display-tracking);line-height:var(--type-display-line-height);font-size:min(var(--type-display-size-desktop),150px);text-transform:var(--type-display-transform)}
.h1{font-family:var(--type-h1-family);font-weight:var(--type-h1-weight);letter-spacing:var(--type-h1-tracking);line-height:var(--type-h1-line-height);font-size:min(var(--type-h1-size-desktop),110px)}
.ld{font-family:var(--type-lead-family);font-size:34px;line-height:var(--type-lead-line-height);max-width:1100px;opacity:.85}
.on-img{color:var(--color-text-inverse)}
.on-img .in{text-shadow:0 2px 28px color-mix(in srgb,var(--color-surface-inverse) 70%,transparent)}
.ai-label{font-size:18px;padding:9px 14px;right:40px;bottom:40px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:40px}
.stats b{display:block;font-family:var(--type-display-family);font-weight:var(--type-display-weight);font-size:150px;line-height:1;letter-spacing:var(--type-display-tracking)}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:28px}
.cc{position:relative;height:330px;border-radius:var(--card-radius);overflow:hidden;color:var(--color-text-inverse)}
.cc .media{position:absolute;inset:0}.cc b{position:absolute;z-index:2;left:24px;bottom:20px;font-size:32px;font-weight:600}
.cc .ai-label{font-size:13px;right:14px;top:14px;bottom:auto}
.pbar{display:flex;height:150px;border-radius:var(--card-radius);overflow:hidden}
.pbar span{transform-origin:left center}
.sw{display:grid;grid-template-columns:repeat(6,1fr);gap:24px;font-size:22px}
.sw i{display:block;height:150px;border-radius:calc(var(--card-radius) * .6);margin-bottom:10px;box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 18%,transparent)}
.cols{display:grid;grid-template-columns:repeat(var(--layout-columns),1fr);gap:var(--layout-gutter);height:360px}
.cols i{background:color-mix(in srgb,var(--color-accent) 25%,transparent);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--color-accent) 60%,transparent);border-radius:8px;transform-origin:bottom}
.btns{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.gr{display:grid;place-items:center;height:200px;border-radius:var(--card-radius)}
.gr .btn{font-size:26px;min-height:64px;padding:0 34px}
.q{font-family:var(--type-h2-family);font-weight:var(--type-h2-weight);font-size:76px;line-height:1.1;letter-spacing:var(--type-h2-tracking);max-width:1500px}
.split{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;width:100%}
.ph-box{position:relative;height:820px;border-radius:var(--card-radius);overflow:hidden}
.ph-box .media{position:absolute;inset:0}
.facts{display:grid;gap:18px;font-size:30px}
.facts b{font-weight:700}
`;

function scenesHtml(a, tokens, manifest, imagesDir) {
  const T = a.typography, R = a.colour.roles, L = a.layout, K = a.components, V = a.voice, I = a.imagery;
  const S = (n) => slot(n, manifest);
  const B = esc(a.brand);
  const st = (h, extra = '') => `<div data-st ${extra}>${h}</div>`;
  const pal = a.colour.palette.slice(0, 12);
  const ps = pal.reduce((s, p) => s + p.score, 0) || 1;
  const sc = [
    ['intro', `<section class="scene on-img">${S('hero')}<div class="scrim"></div><div class="in" style="justify-content:flex-end">${st('<span class="k">Unofficial analysis</span>')}${st(`<h1 class="hd">${B}<br>brand guidelines</h1>`)}${st(`<p class="ld">Measured from ${esc(a.host)}.</p>`)}</div></section>`],
    ['overview', `<section class="scene"><div class="in">${st('<span class="k">Overview</span>')}${st(`<h2 class="h1">The interface, measured</h2>`)}<div class="stats">${[[a.overview.typefaces, 'typefaces'], [a.overview.colours, 'colours'], [`${L.base}px`, 'spacing base'], [a.overview.buttonVariants, 'button variants']].map(([n, l]) => st(`<b>${n}</b><span style="font-size:28px;opacity:.7">${l}</span>`)).join('')}</div></div></section>`],
    ['contents', `<section class="scene"><div class="in">${st('<span class="k">Contents</span>')}<div class="cards">${[['Typography', 'horizon'], ['Colour', 'object'], ['Layout', 'grid'], ['Components', 'glass'], ['Imagery', 'detail'], ['Voice', 'street'], ['Tokens', 'tokens'], ['Fonts', 'sky']].map(([t, s]) => st(`<div class="cc">${S(s)}<div class="scrim"></div><b>${t}</b></div>`)).join('')}</div></div></section>`],
    ['typography', `<section class="scene on-img">${S('horizon')}<div class="scrim"></div><div class="in">${st(`<span class="k">Typography · ${esc(T.roles.display.family)}</span>`)}${st(`<div class="hd">Aa Bb Cc 123</div>`)}${st(`<div class="h1" style="font-size:min(var(--type-h2-size-desktop),80px)">Display ${T.roles.display.size}px · H1 ${T.roles.h1.size}px · Body ${T.roles.body.size}px</div>`)}${st(`<p class="ld">Scale ratio ${T.ratio}, nearest ${T.interval.name}.</p>`)}</div></section>`],
    ['fonts', `<section class="scene"><div class="in">${st('<span class="k">Fonts</span>')}${T.families.slice(0, 3).map((f) => st(`<div style="display:flex;align-items:baseline;gap:40px"><span class="hd" style="font-family:var(--font-body)">Aa</span><span class="h1" style="font-size:64px">${esc(f.family)}</span><span style="font-size:30px;opacity:.7">${Math.round(f.share * 100)}% of characters</span></div>`)).join('')}</div></section>`],
    ['colour', `<section class="scene dark"><div class="in">${st('<span class="k">Colour</span>')}<div class="pbar">${pal.map((p) => `<span data-bar style="background:${p.hex};flex-grow:${round(p.score / ps, 4)}"></span>`).join('')}</div><div class="sw">${['background', 'surface-inverse', 'text', 'action', 'action-alt', 'accent'].map((r) => st(`<i style="background:var(--color-${r})"></i>${r}<br><span style="opacity:.7">${R[r].hex}</span>`)).join('')}</div></div></section>`],
    ['layout', `<section class="scene"><div class="in">${st('<span class="k">Layout and spacing</span>')}${st(`<h2 class="h1">${L.base}px base · ${L.columns} columns · ${Math.round(L.gutter)}px gutter · ${Math.round(L.container)}px</h2>`)}<div class="cols">${Array.from({ length: L.columns }, () => '<i data-col></i>').join('')}</div></div></section>`],
    ['components', `<section class="scene dark"><div class="in">${st('<span class="k">Components</span>')}${st(`<h2 class="h1">${K.buttons.length} button styles</h2>`)}<div class="btns">${K.buttons.slice(0, 6).map((b, i) => st(`<div class="gr" style="background:var(--button-v${i + 1}-ground)"><span class="btn bv-${i + 1}">${esc(b.labels[0] || 'Button')}</span></div>`)).join('')}</div></div></section>`],
    ['imagery', `<section class="scene"><div class="in"><div class="split"><div class="ph-box">${S('detail')}</div><div class="facts">${st('<span class="k">Imagery</span>')}${st(`<span><b>${Math.round(I.areaShare * 100)}%</b> of page area is media</span>`)}${st(`<span><b>${Math.round(I.fullBleedShare * 100)}%</b> full bleed</span>`)}${st(`<span>Crops: ${I.crops.slice(0, 2).map(([k]) => k).join(', ')}</span>`)}${st(`<span>Formats: ${I.formats.slice(0, 3).map(([k]) => esc(k)).join(', ')}</span>`)}</div></div></div></section>`],
    ['voice', `<section class="scene"><div class="in">${st('<span class="k">Voice and tone</span>')}${V.quotes.slice(0, 2).map((q) => st(`<p class="q">“${esc(q.text)}”</p>`)).join('')}${st(`<p class="ld">${V.rules.map((r) => esc(r.title)).join(' · ')}</p>`)}</div></section>`],
    ['outro', `<section class="scene on-img" style="background:var(--gradient-brand),var(--color-surface-inverse)"><div class="in">${st('<span class="k">Design tokens</span>')}${st(`<h2 class="hd">${Object.keys(tokens.vars).length} variables</h2>`)}${st(`<p class="ld">Unofficial analysis. Not affiliated with or endorsed by ${B}. Trademarks belong to their owners.</p>`)}</div></section>`],
  ];
  const html = sc.map(([n, h]) => h.replace('<section ', `<section data-scene="${n}" `)).join('\n');
  return { count: sc.length, names: sc.map((s) => s[0]), html: `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(a, tokens.css, manifest, imagesDir)}${css}</style></head><body>${html}<span class="unofficial badge">Unofficial analysis</span></body></html>` };
}

// Build the whole timeline with the Web Animations API, paused.
function timelineScript(sceneDur, fade, easing) {
  return `(() => {
    const sceneDur = ${sceneDur}, fade = ${fade};
    const scenes = Array.from(document.querySelectorAll('.scene'));
    const T = scenes.length * sceneDur + fade;
    const ms = T * 1000;
    const ease = ${JSON.stringify(easing)};
    const out = 'cubic-bezier(0.16, 1, 0.3, 1)';
    const at = (t) => Math.min(1, Math.max(0, t / T));
    scenes.forEach((s, i) => {
      const t0 = i * sceneDur, t1 = t0 + fade, t2 = t0 + sceneDur, t3 = t2 + fade;
      const first = i === 0, last = i === scenes.length - 1;
      const kf = [
        { offset: 0, opacity: first ? 1 : 0, transform: first ? 'scale(1)' : 'scale(1.035)', filter: first ? 'blur(0px)' : 'blur(10px)' },
        { offset: at(t0), opacity: first ? 1 : 0, transform: first ? 'scale(1)' : 'scale(1.035)', filter: first ? 'blur(0px)' : 'blur(10px)', easing: ease },
        { offset: at(t1), opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' },
        { offset: at(t2), opacity: 1, transform: 'scale(1)', filter: 'blur(0px)', easing: ease },
        { offset: at(last ? T : t3), opacity: last ? 1 : 0, transform: last ? 'scale(1)' : 'scale(0.985)', filter: last ? 'blur(0px)' : 'blur(8px)' },
        { offset: 1, opacity: last ? 1 : 0, transform: last ? 'scale(1)' : 'scale(0.985)', filter: last ? 'blur(0px)' : 'blur(8px)' },
      ].filter((k, j, arr) => j === 0 || k.offset >= arr[j - 1].offset);
      s.animate(kf, { duration: ms, fill: 'both' });
      s.querySelectorAll('.media > .ph').forEach((p) => p.animate([
        { offset: 0, transform: 'scale(1)' }, { offset: at(t0), transform: 'scale(1)' }, { offset: at(t3), transform: 'scale(1.1)' }, { offset: 1, transform: 'scale(1.1)' },
      ], { duration: ms, fill: 'both' }));
      s.querySelectorAll('[data-st]').forEach((el, k) => {
        const a0 = t0 + (first ? 0.25 : 0.35) + k * 0.09, a1 = a0 + 0.8;
        el.animate([
          { offset: 0, opacity: 0, transform: 'translateY(42px)' }, { offset: at(a0), opacity: 0, transform: 'translateY(42px)', easing: out },
          { offset: at(a1), opacity: 1, transform: 'translateY(0)' }, { offset: 1, opacity: 1, transform: 'translateY(0)' },
        ], { duration: ms, fill: 'both' });
      });
      s.querySelectorAll('[data-bar],[data-col]').forEach((el, k) => {
        const a0 = t0 + 0.5 + k * 0.06, a1 = a0 + 0.9;
        const from = el.hasAttribute('data-bar') ? 'scaleX(0)' : 'scaleY(0)';
        el.animate([
          { offset: 0, transform: from }, { offset: at(a0), transform: from, easing: out },
          { offset: at(a1), transform: 'none' }, { offset: 1, transform: 'none' },
        ], { duration: ms, fill: 'both' });
      });
    });
    document.getAnimations().forEach((x) => x.pause());
    window.__seek = (t) => { document.getAnimations().forEach((x) => { x.pause(); x.currentTime = t; }); };
    return T;
  })()`;
}

async function renderVideo({ a, tokens, manifest, imagesDir, dir, stillsOnly = false }) {
  const vdir = ensureDir(path.join(dir, 'video'));
  const stillsDir = ensureDir(path.join(vdir, 'stills'));
  const { names, html } = scenesHtml(a, tokens, manifest, imagesDir);
  const htmlPath = path.join(vdir, 'scenes.html');
  fs.writeFileSync(htmlPath, html);
  const { browser } = await launch();
  const file = path.join(vdir, `${hostOf(a.url)}-presentation-1920x1080-60fps.mp4`);
  let frames = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const T = await page.evaluate(timelineScript(SCENE, FADE, a.motion.easing));
    const total = Math.round(T * FPS);
    const cdp = await page.context().newCDPSession(page);
    const grab = async (format) => Buffer.from((await cdp.send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 95 : undefined, optimizeForSpeed: true })).data, 'base64');

    // stills: one frame per scene, mid-hold
    for (let i = 0; i < names.length; i++) {
      const t = (i * SCENE + FADE + (SCENE - FADE) * 0.6) * 1000;
      await page.evaluate((x) => window.__seek(x), t);
      fs.writeFileSync(path.join(stillsDir, `scene-${String(i + 1).padStart(2, '0')}-${names[i]}.png`), await grab('png'));
    }
    if (stillsOnly) return { stills: names.length };

    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
    const t0 = Date.now();
    for (let i = 0; i < total; i++) {
      await page.evaluate((x) => window.__seek(x), (i * 1000) / FPS);
      const buf = await grab('jpeg');
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      frames++;
      if (i % 600 === 0) log(`  video frame ${i}/${total} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    ff.stdin.end();
    await done;
  } finally {
    await browser.close();
    fs.unlinkSync(htmlPath);
  }
  return { file, frames, seconds: frames / FPS };
}

module.exports = { renderVideo };
