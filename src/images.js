'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { log, warn, writeJSON, readJSON, ensureDir, loadEnv, kb } = require('./util');

const SRC_EXT = ['.png', '.jpg', '.jpeg', '.webp'];
const HERO_IMAGE_BUDGET = 2.9 * 1024 * 1024; // keeps brand-guide-hero.html under 4 MB after base64

function findSource(dir, slot) {
  for (const e of SRC_EXT) { const p = path.join(dir, slot + e); if (fs.existsSync(p)) return p; }
  return null;
}

function probe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim();
  const [w, h] = out.split(',').map(Number);
  return { w, h };
}

function toWebp(src, dst, maxW, quality) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', `scale='min(${maxW},iw)':-2:flags=lanczos`, '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6', dst]);
  return fs.statSync(dst).size;
}

// Re-encode every slot image to WebP (2000px wide, 1400px others) within the hero budget.
function encodeAll(imagesDir, prompts, manifest) {
  const webDir = ensureDir(path.join(imagesDir, 'webp'));
  for (const q of [82, 74, 66, 58, 50]) {
    let total = 0;
    for (const s of prompts.slots) {
      const m = manifest.slots[s.slot];
      if (!m) continue;
      const wide = (m.w / m.h) >= 1.3;
      const maxW = wide ? 2000 : 1400;
      const dst = path.join(webDir, s.slot + '.webp');
      m.bytes = toWebp(path.join(imagesDir, m.file), dst, maxW, q);
      m.webp = path.relative(imagesDir, dst);
      Object.assign(m, { outW: Math.min(maxW, m.w), quality: q });
      total += m.bytes;
    }
    manifest.webpBytes = total;
    if (total <= HERO_IMAGE_BUDGET) break;
    warn(`WebP total ${kb(total)} over budget at q${q}; re-encoding smaller`);
  }
  return manifest;
}

// --import / manual: build the manifest from images/<slot>.png dropped in by the person.
function importManual(imagesDir, prompts) {
  const manifest = { mode: 'manual', createdAt: new Date().toISOString(), slots: {} };
  for (const s of prompts.slots) {
    const src = findSource(imagesDir, s.slot);
    if (!src) continue;
    const { w, h } = probe(src);
    manifest.slots[s.slot] = { file: path.basename(src), w, h, prompt: s.prompt, aspectRatio: s.aspectRatio, ai: true, provider: 'manual', cost: null };
  }
  const missing = prompts.slots.filter((s) => !manifest.slots[s.slot]).map((s) => s.slot);
  if (missing.length) warn(`no image for: ${missing.join(', ')} (gradient fallback used)`);
  return manifest;
}

function printPrompts(prompts, imagesDir) {
  console.log(`\nIMAGES=manual. Generate these from the text prompts only (never from the brand's photos)`);
  console.log(`and save each as ${imagesDir}/<slot>.png, then run again with --import.\n`);
  for (const s of prompts.slots) console.log(`[${s.slot}] ${s.aspectRatio}, ${s.width}px wide, for ${s.use}\n${s.prompt}\n`);
}

// IMAGES=api: provider adapter with a job ledger so a crash never loses a paid image.
async function generateApi(imagesDir, prompts, { provider: name = 'fal', maxCost = 5, only } = {}) {
  const env = loadEnv(process.cwd());
  const provider = require(`./providers/${name}`);
  const key = env[provider.envKey];
  if (!key) throw new Error(`${provider.envKey} is missing from .env (needed for --images api --provider ${name})`);
  const ledgerPath = path.join(imagesDir, 'jobs.json');
  const ledger = fs.existsSync(ledgerPath) ? readJSON(ledgerPath) : { provider: name, jobs: {} };
  const todo = prompts.slots.filter((s) => (!only || only.includes(s.slot)) && !findSource(imagesDir, s.slot));
  const estimate = todo.length * provider.price;
  const balance = await provider.balance(key).catch((e) => ({ ok: false, note: e.message }));
  log(`provider ${name}: ${todo.length} images, estimated $${estimate.toFixed(2)}${balance.amount != null ? `, balance $${balance.amount}` : ` (${balance.note || 'balance not available'})`}`);
  if (balance.amount != null && balance.amount < estimate) throw new Error(`balance $${balance.amount} is below the estimate $${estimate.toFixed(2)}`);
  if (estimate > maxCost) throw new Error(`estimate $${estimate.toFixed(2)} exceeds --max-cost ${maxCost}`);
  const costs = [];
  for (const s of todo) {
    const dst = path.join(imagesDir, s.slot + '.png');
    let job = ledger.jobs[s.slot];
    if (!job || job.status === 'failed') {
      const sub = await provider.submit(key, { prompt: s.prompt, aspectRatio: s.aspectRatio, resolution: s.width });
      job = ledger.jobs[s.slot] = { ...sub, status: 'submitted', at: new Date().toISOString(), prompt: s.prompt };
      writeJSON(ledgerPath, ledger); // saved before polling
    }
    try {
      const result = await provider.wait(key, job);
      await provider.download(key, result, dst); // streamed to disk
      job.status = 'done'; job.cost = provider.price; job.file = path.basename(dst);
      costs.push({ slot: s.slot, cost: provider.price, jobId: job.id });
      log(`  ${s.slot}: $${provider.price.toFixed(3)} (job ${job.id})`);
    } catch (e) {
      job.status = 'failed'; job.error = e.message;
      warn(`${s.slot} failed: ${e.message}`);
    }
    writeJSON(ledgerPath, ledger);
  }
  const manifest = importManual(imagesDir, prompts);
  manifest.mode = 'api';
  for (const [slot, m] of Object.entries(manifest.slots)) { const j = ledger.jobs[slot]; if (j) Object.assign(m, { provider: name, jobId: j.id, cost: j.cost ?? null }); }
  return { manifest, costs };
}

module.exports = { importManual, printPrompts, generateApi, encodeAll, findSource };
