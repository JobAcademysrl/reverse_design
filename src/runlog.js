'use strict';
const fs = require('fs');
const path = require('path');
const { kb } = require('./util');

function writeRunLog(dir, d, a) {
  const L = [];
  const s = (ms) => `${(ms / 1000).toFixed(1)} s`;
  L.push(`# reverse-brand run log: ${a.host}`, '', `Unofficial analysis of ${d.url}. Not affiliated with or endorsed by ${a.brand}. Trademarks belong to their owners.`, '');
  L.push(`- Date: ${new Date().toISOString()}`, `- Browser: ${d.browser || 'n/a'}`, `- Options: ${JSON.stringify(d.options || {})}`, `- Total time: ${d.totalMs ? s(d.totalMs) : 'n/a'}`, '');
  L.push('## Timing per phase', '', '| Phase | Time |', '|---|---|');
  for (const [k, v] of Object.entries(d.phases || {})) L.push(`| ${k} | ${s(v.ms)} |`);
  L.push('', '## Pages and elements', '', '| Page | Role | Score | Why | Elements | Excluded (consent) |', '|---|---|---|---|---|---|');
  for (const p of (d.capture && d.capture.pages) || []) L.push(`| ${p.url} | ${p.role} | ${p.score ?? ''} | ${(p.reasons || []).join(', ')} | ${p.elements} | ${p.excluded} |`);
  if (d.capture) L.push(`| ${d.url} at 390px | mobile | | | ${d.capture.mobileElements} | |`);
  L.push('', `Total visible elements read: ${a.stats.elements}.`, '');
  L.push('## Sizes', '', '| File | Size |', '|---|---|');
  for (const f of ['brand-guide.html', 'brand-guide-hero.html', 'tokens.css', 'tokens.json', 'snapshot.json', 'prompts.json']) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) L.push(`| ${f} | ${kb(fs.statSync(p).size)} |`);
  }
  for (const sub of ['slides', 'video', 'screenshots']) {
    const p = path.join(dir, sub);
    if (!fs.existsSync(p)) continue;
    const files = walk(p);
    L.push(`| ${sub}/ (${files.length} files) | ${kb(files.reduce((t, f) => t + fs.statSync(f).size, 0))} |`);
  }
  L.push('', '## Images and cost', '');
  if (d.images && d.images.length) {
    L.push('| Slot | Cost (USD) | Job |', '|---|---|---|');
    let t = 0;
    for (const i of d.images) { L.push(`| ${i.slot} | ${i.cost.toFixed(3)} | ${i.jobId} |`); t += i.cost; }
    L.push(`| total | ${t.toFixed(3)} | |`);
  } else L.push(`No paid images in this run (IMAGES=${(d.options || {}).images || 'none'}). Image cost: $0.`);
  L.push('', '## LLM token usage', '', d.llm ? JSON.stringify(d.llm) : 'The CLI makes no LLM calls; analysis is deterministic. Token usage of the assistant that drove the run is not known to the CLI.', '');
  L.push('## Assumptions', '');
  for (const x of d.assumptions || []) L.push(`- ${x}`);
  if (d.notes && d.notes.length) { L.push('', '## Notes', ''); for (const x of d.notes) L.push(`- ${x}`); }
  if (d.verify) {
    L.push('', '## Verify', '', `Result: ${d.verify.ok ? 'pass' : 'FAIL'} (${d.verify.checks.length} checks)`, '');
    for (const c of d.verify.checks) L.push(`- ${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? `: ${c.detail}` : ''}`);
  }
  fs.writeFileSync(path.join(dir, 'run-log.md'), L.join('\n') + '\n');
}

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
}

module.exports = { writeRunLog };
