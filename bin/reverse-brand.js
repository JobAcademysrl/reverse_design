#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { log, warn, hostOf, ensureDir, readJSON, writeJSON, RunLog, kb } = require('../src/util');

const HELP = `reverse-brand <url> [options]

Turns a public brand website into an unofficial, art-directed brand guide.

Options
  --images none|api|manual   Image mode (default: none)
  --provider fal|openai      Provider for --images api (default: fal)
  --max-cost <usd>           Refuse an api run whose estimate is higher (default: 5)
  --import                   Build the image manifest from out/<host>/images/<slot>.png
  --headed                   Visible browser; you complete any bot check yourself
  --snapshot <file>          Skip capture and use a snapshot.json (from the DevTools snippet)
  --reuse                    Reuse out/<host>/snapshot.json if present
  --pages <n>                Key pages besides home, 3 to 5 (default: 5)
  --out <dir>                Output root (default: ./out)
  --stills                   Write one still per video scene only (no mp4)
  --skip-slides, --skip-video, --skip-verify
  --snippet                  Print the DevTools snippet and exit
`;

function parseArgs(argv) {
  const o = { images: 'none', provider: 'fal', maxCost: 5, pages: 5, out: path.resolve('out') };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--images') o.images = next();
    else if (a === '--provider') o.provider = next();
    else if (a === '--max-cost') o.maxCost = +next();
    else if (a === '--import') o.import = true;
    else if (a === '--headed') o.headed = true;
    else if (a === '--snapshot') o.snapshot = path.resolve(next());
    else if (a === '--reuse') o.reuse = true;
    else if (a === '--pages') o.pages = Math.max(3, Math.min(5, +next()));
    else if (a === '--out') o.out = path.resolve(next());
    else if (a === '--stills') o.stillsOnly = true;
    else if (a === '--skip-slides') o.skipSlides = true;
    else if (a === '--skip-video') o.skipVideo = true;
    else if (a === '--skip-verify') o.skipVerify = true;
    else if (a === '--snippet') o.snippet = true;
    else if (a === '-h' || a === '--help') o.help = true;
    else rest.push(a);
  }
  o.url = rest[0];
  if (!['none', 'api', 'manual'].includes(o.images)) throw new Error(`--images must be none, api or manual`);
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || (!o.url && !o.snippet)) { console.log(HELP); return; }
  if (o.snippet) { console.log(require('../src/snippet').buildSnippet({ maxPages: o.pages })); return; }
  if (!/^https?:\/\//.test(o.url)) o.url = 'https://' + o.url;
  const t0 = Date.now();
  const dir = ensureDir(path.join(o.out, hostOf(o.url)));
  const imagesDir = ensureDir(path.join(dir, 'images'));
  const runlog = new RunLog(path.join(dir, '.runlog.json'));
  runlog.data.phases = {};
  runlog.data.assumptions = [];
  runlog.data.notes = [];
  runlog.set('url', o.url);
  runlog.set('options', { images: o.images, provider: o.images === 'api' ? o.provider : null, headed: !!o.headed, pages: o.pages });

  // 1. capture
  const snapPath = path.join(dir, 'snapshot.json');
  let snapshot;
  if (o.snapshot) { snapshot = readJSON(o.snapshot); writeJSON(snapPath, snapshot); runlog.assume(`Snapshot supplied from ${path.basename(o.snapshot)} (${snapshot.meta.source}).`); }
  else if (o.reuse && fs.existsSync(snapPath)) { snapshot = readJSON(snapPath); runlog.note('Reused the existing snapshot.json.'); }
  else {
    const { capture, ChallengeError } = require('../src/capture');
    try {
      snapshot = await runlog.phase('capture', () => capture(o.url, { headed: o.headed, maxPages: o.pages, runlog }));
    } catch (e) {
      if (!(e instanceof ChallengeError)) throw e;
      const snip = path.join(dir, 'devtools-snippet.js');
      fs.writeFileSync(snip, require('../src/snippet').buildSnippet({ maxPages: o.pages }));
      console.error(`\nStopped: ${e.message}. reverse-brand never bypasses bot checks or CAPTCHAs.\nChoose one:\n  (a) reverse-brand ${o.url} --headed     and complete the check yourself in the window\n  (b) open ${o.url} in your browser, paste ${snip} into the DevTools console,\n      then run: reverse-brand ${o.url} --snapshot ~/Downloads/snapshot.json\n`);
      process.exitCode = 2;
      return;
    }
    writeJSON(snapPath, snapshot);
  }
  runlog.set('browser', snapshot.meta.browser);
  runlog.set('capture', { pages: snapshot.pages.map((p) => ({ url: p.url, role: p.role, score: p.score, reasons: p.reasons, elements: p.data.elements, excluded: p.data.excluded })), mobileElements: snapshot.mobile ? snapshot.mobile.data.elements : 0, picks: snapshot.picks });
  runlog.assume('Viewports: 1440×900 for every page, 390×844 for the home page (responsive type).');
  if (snapshot.pages.length < 4) runlog.assume(`Only ${snapshot.pages.length - 1} key pages qualified after skipping legal, help, login and locale duplicates.`);

  // 2. analyse
  const { analyse } = require('../src/analyse');
  const a = await runlog.phase('analyse', () => analyse(snapshot, runlog));
  writeJSON(path.join(dir, 'analysis.json'), a);

  // 3. tokens
  const { buildTokens } = require('../src/tokens');
  const tokens = await runlog.phase('tokens', () => buildTokens(a));
  fs.writeFileSync(path.join(dir, 'tokens.css'), tokens.css);
  writeJSON(path.join(dir, 'tokens.json'), tokens.json);

  // 4. prompts and images
  const { buildPrompts } = require('../src/prompts');
  const promptsPath = path.join(dir, 'prompts.json');
  const prompts = buildPrompts(a, promptsPath);
  writeJSON(promptsPath, prompts);
  const images = require('../src/images');
  let manifest = null;
  await runlog.phase('images', async () => {
    const manifestPath = path.join(imagesDir, 'manifest.json');
    if (o.images === 'none' && !o.import) { runlog.assume('IMAGES=none: every image slot uses its CSS-gradient fallback.'); return; }
    if (o.images === 'api') {
      const { manifest: m, costs } = await images.generateApi(imagesDir, prompts, { provider: o.provider, maxCost: o.maxCost });
      manifest = m;
      runlog.set('images', costs);
    } else {
      const have = prompts.slots.some((s) => images.findSource(imagesDir, s.slot));
      if (!have) { images.printPrompts(prompts, imagesDir); runlog.assume('IMAGES=manual: no images found yet; gradient fallbacks used. Re-run with --import after adding images.'); return; }
      manifest = images.importManual(imagesDir, prompts);
    }
    images.encodeAll(imagesDir, prompts, manifest);
    writeJSON(manifestPath, manifest);
    log(`images: ${Object.keys(manifest.slots).length} slots, WebP total ${kb(manifest.webpBytes || 0)}`);
  });
  if (!manifest && fs.existsSync(path.join(imagesDir, 'manifest.json')) && o.images !== 'none') manifest = readJSON(path.join(imagesDir, 'manifest.json'));

  // 5. guide, both editions
  const { renderGuide } = require('../src/guide');
  await runlog.phase('guide', () => {
    for (const [file, edition] of [['brand-guide.html', 'light'], ['brand-guide-hero.html', 'hero']]) {
      const html = renderGuide({ a, tokens, manifest, imagesDir, prompts, runlog: runlog.data, edition });
      fs.writeFileSync(path.join(dir, file), html);
      runlog.data.sizes[file] = Buffer.byteLength(html);
      log(`${file}: ${kb(Buffer.byteLength(html))}`);
    }
  });
  if (!manifest) runlog.assume('brand-guide-hero.html has no images to embed, so it matches the light edition.');

  // 6. slides
  if (!o.skipSlides) {
    const { renderSlides } = require('../src/slides');
    await runlog.phase('slides', () => renderSlides({ a, tokens, manifest, imagesDir, dir }));
  }

  // 7. video
  if (!o.skipVideo) {
    const { renderVideo } = require('../src/video');
    await runlog.phase('video', () => renderVideo({ a, tokens, manifest, imagesDir, dir, stillsOnly: o.stillsOnly }));
  }

  // 8. verify and screenshots
  if (!o.skipVerify) {
    const { verify, screenshots } = require('../src/verify-lib');
    const result = await runlog.phase('verify', () => verify(dir));
    runlog.set('verify', result);
    await runlog.phase('screenshots', () => screenshots(dir));
    if (!result.ok) { warn(`verify failed: ${result.failures.join('; ')}`); process.exitCode = 1; }
  }

  // 9. log
  runlog.set('totalMs', Date.now() - t0);
  require('../src/runlog').writeRunLog(dir, runlog.data, a);
  log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s → ${dir}`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
