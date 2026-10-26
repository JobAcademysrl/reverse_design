'use strict';
// Builds a paste-into-DevTools snippet that runs the same extractor in
// same-origin iframes at 1440px and 390px, then downloads snapshot.json.
// Used when headless capture meets a bot check: the person opens the site in
// their own browser (passing any check themselves) and pastes this snippet.
const { extractPage } = require('./extract-page');
const { scoreLinks } = require('./score-links');
const { parseCss } = require('./css-parse');

function buildSnippet({ maxPages = 5 } = {}) {
  return `// reverse-brand DevTools snippet: paste into the Console on the site's home page.
// It reads computed styles only, in same-origin iframes, and downloads snapshot.json.
(async () => {
const extractPage = ${extractPage.toString()};
const scoreLinks = ${scoreLinks.toString()};
const parseCss = ${parseCss.toString()};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function inFrame(url, w, h) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:0;top:0;border:0;z-index:2147483647;background:#fff;pointer-events:none;opacity:0.02;width:' + w + 'px;height:' + h + 'px';
  f.src = url;
  document.body.appendChild(f);
  await new Promise((r) => { f.onload = r; setTimeout(r, 30000); });
  await sleep(1500);
  const win = f.contentWindow;
  if (!win || !win.document || !win.document.body) { f.remove(); throw new Error('frame blocked: ' + url); }
  for (let y = 0, i = 0; i < 40 && y < win.document.documentElement.scrollHeight; i++, y += Math.round(h * 0.8)) { win.scrollTo({ top: y, behavior: 'instant' }); await sleep(220); }
  win.scrollTo({ top: 0, behavior: 'instant' }); await sleep(800);
  const data = extractPage(win, {});
  const sheets = Array.from(win.document.styleSheets).map((s) => s.href).filter(Boolean);
  f.remove();
  return { data, sheets };
}
const home = location.href.split('#')[0];
const snap = { tool: 'reverse-brand@0.1.0', meta: { url: home, host: location.host, capturedAt: new Date().toISOString(), browser: navigator.userAgent, desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 }, source: 'devtools-snippet' }, pages: [], mobile: null, css: null, picks: [] };
let first;
try { first = await inFrame(home, 1440, 900); } catch (e) { console.warn(e.message, '- falling back to this window at its current width'); first = { data: extractPage(window, {}), sheets: [] }; snap.meta.fallback = 'current window'; }
snap.pages.push({ url: home, path: location.pathname, role: 'home', data: first.data });
snap.picks = scoreLinks(first.data.links, home, ${maxPages});
for (const p of snap.picks) {
  try { const r = await inFrame(p.url, 1440, 900); snap.pages.push({ url: p.url, path: p.path, role: 'key', score: p.score, reasons: p.reasons, data: r.data }); console.log('captured', p.path); }
  catch (e) { console.warn('skipped', p.url, e.message); }
}
try { snap.mobile = { url: home, data: (await inFrame(home, 390, 844)).data }; } catch (e) { console.warn('mobile pass failed', e.message); }
const texts = Array.from(document.querySelectorAll('style')).map((s) => s.textContent);
for (const href of first.sheets.slice(0, 25)) { try { const r = await fetch(href); if (r.ok) texts.push(await r.text()); } catch (e) {} }
snap.css = Object.assign({ hrefs: first.sheets }, parseCss(texts));
const a = document.createElement('a');
a.href = URL.createObjectURL(new Blob([JSON.stringify(snap)], { type: 'application/json' }));
a.download = 'snapshot.json';
document.body.appendChild(a); a.click(); a.remove();
console.log('reverse-brand: snapshot.json downloaded. Run: reverse-brand ' + home + ' --snapshot path/to/snapshot.json');
})();
`;
}

module.exports = { buildSnippet };
