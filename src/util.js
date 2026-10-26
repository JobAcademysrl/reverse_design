'use strict';
const fs = require('fs');
const path = require('path');

const log = (...a) => console.log('[reverse-brand]', ...a);
const warn = (...a) => console.warn('[reverse-brand] warning:', ...a);

function hostOf(url) { return new URL(url).host.replace(/^www\./, '').replace(/:/g, '_'); }

function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); return d; }
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJSON = (p, v) => { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(v, null, 2)); };

// Run log shared by every phase; written to run-log.md at the end.
class RunLog {
  constructor(file) {
    this.file = file;
    this.data = fs.existsSync(file) ? readJSON(file) : { phases: {}, assumptions: [], notes: [], images: [], llm: null, sizes: {} };
  }
  async phase(name, fn) {
    const t0 = Date.now();
    log(`→ ${name}`);
    try { return await fn(); } finally {
      const ms = Date.now() - t0;
      this.data.phases[name] = { ms, at: new Date().toISOString() };
      log(`✓ ${name} (${(ms / 1000).toFixed(1)} s)`);
      this.save();
    }
  }
  assume(text) { if (!this.data.assumptions.includes(text)) this.data.assumptions.push(text); }
  note(text) { this.data.notes.push(text); }
  set(k, v) { this.data[k] = v; this.save(); }
  save() { writeJSON(this.file, this.data); }
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

// Read KEY=value lines from .env without ever printing them.
function loadEnv(dir) {
  const env = {};
  for (const p of [path.join(dir, '.env'), path.join(process.cwd(), '.env')]) {
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return { ...env, ...process.env };
}

module.exports = { log, warn, hostOf, ensureDir, readJSON, writeJSON, RunLog, esc, round, kb, loadEnv };
