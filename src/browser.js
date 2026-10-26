'use strict';
const { chromium } = require('playwright');
const { warn } = require('./util');

// Prefer an installed Chrome; fall back to Playwright's Chromium.
// --disable-gpu: some machines hang on the first canvas call without it.
async function launch({ headed = false } = {}) {
  const args = ['--disable-gpu', '--font-render-hinting=none'];
  try {
    const b = await chromium.launch({ channel: 'chrome', headless: !headed, args });
    return { browser: b, name: 'Google Chrome ' + b.version() };
  } catch (e) {
    if (process.env.RB_CHROME_PATH) {
      const b = await chromium.launch({ executablePath: process.env.RB_CHROME_PATH, headless: !headed, args });
      return { browser: b, name: 'Chrome at RB_CHROME_PATH ' + b.version() };
    }
    warn('installed Chrome not found, using Playwright Chromium');
    const b = await chromium.launch({ headless: !headed, args });
    return { browser: b, name: 'Chromium ' + b.version() };
  }
}

module.exports = { launch };
