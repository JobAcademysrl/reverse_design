#!/usr/bin/env node
'use strict';
// Usage: node verify.js out/<host>
const path = require('path');
const { verify } = require('./src/verify-lib');

(async () => {
  const dir = path.resolve(process.argv[2] || '.');
  const r = await verify(dir);
  for (const c of r.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  console.log(r.ok ? `\nverify: all ${r.checks.length} checks pass` : `\nverify: ${r.failures.length} of ${r.checks.length} checks failed`);
  process.exit(r.ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
