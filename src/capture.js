'use strict';
const { launch } = require('./browser');
const { extractPage } = require('./extract-page');
const { scoreLinks } = require('./score-links');
const { parseCss } = require('./css-parse');
const { log, warn } = require('./util');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

class ChallengeError extends Error {
  constructor(url, reason) { super(`Bot check on ${url}: ${reason}`); this.url = url; this.reason = reason; }
}

const CHALLENGE_TITLE = /just a moment|attention required|access denied|pardon our interruption|are you a robot|security check|verify you are human|ddos-guard|request blocked|one more step/i;
const CHALLENGE_SEL = '#challenge-form,#challenge-running,#cf-challenge-running,.cf-turnstile,iframe[src*="challenges.cloudflare.com"],#px-captcha,#captcha-container,.h-captcha,iframe[src*="captcha-delivery.com"],iframe[src*="hcaptcha.com"]';
const CHALLENGE_TEXT = /captcha|verify you are human|unusual traffic|enable javascript and cookies to continue|checking your browser|press (and|&) hold/i;

async function detectChallenge(page, status) {
  const i = await page.evaluate((sel) => ({
    title: document.title || '',
    text: (document.body && document.body.innerText || '').slice(0, 4000),
    sel: !!document.querySelector(sel),
  }), CHALLENGE_SEL).catch(() => ({ title: '', text: '', sel: false }));
  if (i.sel) return 'challenge widget on the page';
  if (CHALLENGE_TITLE.test(i.title)) return `challenge title "${i.title}"`;
  if (i.text.length < 1500 && CHALLENGE_TEXT.test(i.text)) return 'challenge text on a near-empty page';
  if ([403, 429, 503].includes(status) && i.text.length < 1500) return `HTTP ${status} with almost no content`;
  return null;
}

async function open(page, url, { headed }) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  let reason = await detectChallenge(page, res ? res.status() : 0);
  if (reason && headed) {
    // The person completes the check in the visible window; we only wait.
    log(`bot check detected (${reason}). Complete it in the browser window; waiting up to 5 minutes…`);
    const until = Date.now() + 5 * 60000;
    while (reason && Date.now() < until) {
      await page.waitForTimeout(2000);
      reason = await detectChallenge(page, 200);
    }
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  }
  if (reason) throw new ChallengeError(url, reason);
  return res;
}

async function scroll(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const go = (y) => window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    let y = 0;
    for (let i = 0; i < 40; i++) {
      const h = document.documentElement.scrollHeight;
      if (y >= h) break;
      go(y);
      await sleep(220);
      y += Math.round(window.innerHeight * 0.8);
    }
    go(0);
    await sleep(500);
  });
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
}

const runExtractor = (page) => page.evaluate(`(${extractPage.toString()})(window, {})`);

async function collectCss(page, ctx) {
  const { hrefs, inline } = await page.evaluate(() => ({
    hrefs: Array.from(document.styleSheets).map((s) => s.href).filter(Boolean),
    inline: Array.from(document.querySelectorAll('style')).map((s) => s.textContent),
  }));
  const texts = [...inline];
  for (const href of hrefs.slice(0, 25)) {
    try {
      const r = await ctx.request.get(href, { timeout: 20000 });
      if (r.ok()) texts.push((await r.text()).slice(0, 4e6));
    } catch (e) { warn(`stylesheet not read: ${href}`); }
  }
  return { hrefs, ...parseCss(texts) };
}

async function capture(url, { headed = false, maxPages = 5, runlog } = {}) {
  const { browser, name } = await launch({ headed });
  log(`browser: ${name}`);
  const snapshot = {
    tool: 'reverse-brand@0.1.0',
    meta: { url, host: new URL(url).host, capturedAt: new Date().toISOString(), browser: name, headed, desktop: DESKTOP, mobile: MOBILE, source: 'playwright' },
    pages: [], mobile: null, css: null, picks: [],
  };
  try {
    const ctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await open(page, url, { headed });
    await scroll(page);
    const home = await runExtractor(page);
    snapshot.pages.push({ url: page.url(), path: new URL(page.url()).pathname, role: 'home', data: home });
    snapshot.css = await collectCss(page, ctx);
    const picks = scoreLinks(home.links, page.url(), maxPages);
    snapshot.picks = picks;
    log(`pages picked: ${picks.map((p) => p.path).join(', ') || '(none found)'}`);
    for (const p of picks) {
      try {
        await open(page, p.url, { headed });
        await scroll(page);
        const data = await runExtractor(page);
        snapshot.pages.push({ url: p.url, path: p.path, role: 'key', score: p.score, reasons: p.reasons, data });
      } catch (e) {
        if (e instanceof ChallengeError && snapshot.pages.length === 1) throw e;
        warn(`skipped ${p.url}: ${e.message}`);
        runlog && runlog.note(`Skipped ${p.url}: ${e.message}`);
      }
    }
    await ctx.close();

    const mctx = await browser.newContext({ viewport: MOBILE, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const mp = await mctx.newPage();
    await open(mp, url, { headed });
    await scroll(mp);
    snapshot.mobile = { url: mp.url(), data: await runExtractor(mp) };
    await mctx.close();
  } finally {
    await browser.close();
  }
  return snapshot;
}

module.exports = { capture, ChallengeError, detectChallenge, DESKTOP, MOBILE };
