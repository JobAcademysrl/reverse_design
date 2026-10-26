'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const { launch } = require('./browser');
const { ensureDir, kb } = require('./util');

const SECTIONS = ['cover', 'overview', 'contents', 'rebuild', 'typography', 'fonts', 'colour', 'layout', 'components', 'imagery', 'voice', 'tokens', 'method'];
const BUDGET = { 'brand-guide.html': 150 * 1024, 'brand-guide-hero.html': 4 * 1024 * 1024 };

async function checkGuide(browser, file, checks) {
  const add = (name, ok, detail) => checks.push({ name: `${path.basename(file)}: ${name}`, ok: !!ok, detail });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const external = [];
  page.on('request', (r) => { const u = r.url(); if (!/^(file|data|blob|about):/.test(u)) external.push(u); });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(300);
  add('zero network requests offline', external.length === 0, external.length ? external.slice(0, 3).join(', ') : '0 requests');

  const size = fs.statSync(file).size;
  add('size budget', size <= BUDGET[path.basename(file)], `${kb(size)} of ${kb(BUDGET[path.basename(file)])}`);

  const missing = await page.evaluate((ids) => ids.filter((id) => !document.getElementById(id)), SECTIONS);
  add('required sections', missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : `${SECTIONS.length} sections`);

  const un = await page.evaluate(() => ({
    cover: /Unofficial analysis/.test((document.querySelector('#cover') || {}).innerText || ''),
    bar: /Unofficial analysis/.test((document.querySelector('#topbar') || {}).innerText || ''),
    foot: /Unofficial analysis/.test((document.querySelector('footer') || {}).innerText || ''),
    disc: /Not affiliated with or endorsed by .+\. Trademarks belong to their owners\./.test(document.body.innerText),
  }));
  add('Unofficial label on cover, top bar and footer, plus disclaimer', un.cover && un.bar && un.foot && un.disc, JSON.stringify(un));

  const json = await page.evaluate(() => { try { const j = JSON.parse(document.getElementById('tokens-json').textContent); return Object.keys(j).length; } catch (e) { return -1; } });
  add('embedded token JSON parses', json > 0, `${json} top-level keys`);

  const counts = await page.evaluate(() => ({ q: document.querySelectorAll('[data-quote]').length, r: document.querySelectorAll('[data-rule]').length, long: Array.from(document.querySelectorAll('[data-quote] p')).filter((p) => p.innerText.replace(/[“”]/g, '').trim().split(/\s+/).length > 15).length }));
  add('five quotes (15 words or fewer) and three rules', counts.q === 5 && counts.r === 3 && counts.long === 0, `${counts.q} quotes, ${counts.r} rules, ${counts.long} too long`);

  const rb = await page.evaluate(() => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const tok = (prop, v) => { probe.style.cssText = `${prop}:var(${v})`; return getComputedStyle(probe).getPropertyValue(prop); };
    const out = [];
    const cmp = (el, label, prop, v) => { const got = getComputedStyle(el).getPropertyValue(prop); const want = tok(prop, v); out.push({ label, prop, got, want, ok: got === want }); };
    document.querySelectorAll('[data-rebuild=button]').forEach((b, i) => {
      cmp(b, `button ${i + 1}`, 'background-color', '--button-bg');
      cmp(b, `button ${i + 1}`, 'color', '--button-fg');
      cmp(b, `button ${i + 1}`, 'border-top-left-radius', '--button-radius');
      cmp(b, `button ${i + 1}`, 'height', '--button-height');
      cmp(b, `button ${i + 1}`, 'font-size', '--button-font-size');
      cmp(b, `button ${i + 1}`, 'font-weight', '--button-font-weight');
    });
    document.querySelectorAll('[data-rebuild=card]').forEach((c, i) => {
      cmp(c, `card ${i + 1}`, 'background-color', '--card-bg');
      cmp(c, `card ${i + 1}`, 'border-top-left-radius', '--card-radius');
      cmp(c, `card ${i + 1}`, 'box-shadow', '--card-shadow');
      cmp(c.querySelector('.rb-body'), `card ${i + 1} body`, 'padding-top', '--card-padding');
    });
    probe.remove();
    return out;
  });
  const bad = rb.filter((x) => !x.ok);
  add('rebuild button and card computed styles equal tokens', rb.length >= 10 && bad.length === 0, bad.length ? bad.slice(0, 3).map((x) => `${x.label} ${x.prop} ${x.got} ≠ ${x.want}`).join('; ') : `${rb.length} properties match`);

  const ai = await page.evaluate(() => {
    const withImg = Array.from(document.querySelectorAll('.ph')).filter((p) => /url\(/.test(getComputedStyle(p).backgroundImage));
    const unlabeled = withImg.filter((p) => !p.parentElement.querySelector(':scope > .ai-label') || !/AI-generated image/.test(p.parentElement.querySelector(':scope > .ai-label').textContent));
    return { images: withImg.length, unlabeled: unlabeled.length };
  });
  add('AI label on every image', ai.unlabeled === 0, `${ai.images} images, ${ai.unlabeled} unlabeled`);
  await ctx.close();

  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  await mp.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  const sw = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, culprit: Array.from(document.querySelectorAll('body *')).filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !e.closest('.table-wrap,pre,.media,.topbar')).slice(0, 3).map((e) => e.tagName + '.' + (e.className || '').toString().slice(0, 30)) }));
  add('no horizontal scroll at 390px', sw.sw <= sw.cw, `scrollWidth ${sw.sw}, clientWidth ${sw.cw}${sw.culprit.length ? ', wide: ' + sw.culprit.join(', ') : ''}`);
  await m.close();
}

async function verify(dir) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
  for (const f of ['tokens.json', 'snapshot.json', 'prompts.json']) {
    try { JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); add(`${f} parses`, true); } catch (e) { add(`${f} parses`, false, e.message); }
  }
  const { browser } = await launch();
  try {
    for (const f of ['brand-guide.html', 'brand-guide-hero.html']) {
      const p = path.join(dir, f);
      if (!fs.existsSync(p)) { add(`${f} exists`, false); continue; }
      await checkGuide(browser, p, checks);
    }
  } finally { await browser.close(); }

  const slidesDir = path.join(dir, 'slides');
  if (fs.existsSync(path.join(slidesDir, 'slides.json'))) {
    const s = JSON.parse(fs.readFileSync(path.join(slidesDir, 'slides.json'), 'utf8'));
    add('slides: 8 Instagram + 4 X images', s.slides.filter((x) => x.kind === 'instagram').length === 8 && s.slides.filter((x) => x.kind === 'x').length === 4, `${s.slides.length} slides`);
    add('slides: Unofficial badge on every slide, AI credit with every photo', s.slides.every((x) => x.badge && (!x.photo || x.aiCredit)), '');
  }
  const vdir = path.join(dir, 'video');
  const mp4 = fs.existsSync(vdir) && fs.readdirSync(vdir).find((f) => f.endsWith('.mp4'));
  if (mp4) {
    try {
      const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,pix_fmt,color_range,color_space:format=duration', '-of', 'json', path.join(vdir, mp4)]).toString();
      const j = JSON.parse(out);
      const st = j.streams[0];
      const ok = st.width === 1920 && st.height === 1080 && st.r_frame_rate === '60/1' && st.pix_fmt === 'yuv420p';
      add('video: 1920×1080, 60 fps, yuv420p', ok, `${st.width}×${st.height} ${st.r_frame_rate} ${st.pix_fmt} ${st.color_range}/${st.color_space}, ${(+j.format.duration).toFixed(1)} s`);
    } catch (e) { add('video probe', false, e.message); }
  }
  const failures = checks.filter((c) => !c.ok).map((c) => `${c.name} (${c.detail || ''})`);
  return { ok: failures.length === 0, checks, failures };
}

// Screenshot every section of both editions at 1440 and 390 for visual review.
async function screenshots(dir) {
  const out = ensureDir(path.join(dir, 'screenshots'));
  const { browser } = await launch();
  const shots = [];
  try {
    for (const [file, tag] of [['brand-guide.html', 'light'], ['brand-guide-hero.html', 'hero']]) {
      const p = path.join(dir, file);
      if (!fs.existsSync(p)) continue;
      for (const [w, h] of [[1440, 900], [390, 844]]) {
        if (tag === 'hero' && w === 390) continue;
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        await page.goto(pathToFileURL(p).href, { waitUntil: 'load' });
        await page.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in')));
        await page.addStyleTag({ content: '.topbar{position:absolute!important}' });
        for (const id of SECTIONS) {
          const el = await page.$('#' + id);
          if (!el) continue;
          await el.scrollIntoViewIfNeeded();
          await page.waitForTimeout(120);
          const f = path.join(out, `${tag}-${w}-${String(SECTIONS.indexOf(id) + 1).padStart(2, '0')}-${id}.png`);
          await el.screenshot({ path: f });
          shots.push(f);
        }
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
  return shots;
}

module.exports = { verify, screenshots, SECTIONS };
