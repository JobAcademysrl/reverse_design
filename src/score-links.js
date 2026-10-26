'use strict';
// Pure, self-contained link scorer (also stringified into the DevTools snippet).
// Returns the best same-origin pages, one per top-level path.

function scoreLinks(links, homeUrl, max) {
  max = max || 5;
  const home = new URL(homeUrl);
  const SKIP = /(^|\/)(legal|terms|privacy|cookies?|policy|policies|imprint|impressum|gdpr|help|support|faq|login|log-in|signin|sign-in|signup|sign-up|register|account|cart|checkout|search|status|careers?\/.+|jobs?\/.+|press\/.+|blog\/.+|news\/.+|tag|category|author|sitemap|rss|feed|cdn-cgi|wp-admin|note-legali|cookie)(\/|$|\.)/i;
  const HIGH = /(product|products|pricing|price|plans?|business|enterprise|company|about|solutions?|platform|features?|services?|shop|store|why|customers?|chi-siamo|prodotti|prezzi|aziende|servizi|soluzioni)/i;
  const LOCALE = /^\/([a-z]{2}([-_][a-z]{2})?)(\/|$)/i;
  const byPath = new Map();
  const seen = new Map();
  for (let l of links) {
    let u;
    try { u = new URL(l.href); } catch (e) { continue; }
    if (u.origin !== home.origin) continue;
    let path = u.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' || path === home.pathname.replace(/\/+$/, '')) continue;
    if (/\.(pdf|zip|jpe?g|png|webp|svg|mp4|xml|json|txt)$/i.test(path)) continue;
    if (SKIP.test(path) || SKIP.test(l.text || '')) continue;
    const loc = path.match(LOCALE);
    if (loc && !/^\/(us|uk|ai|io|go)\b/i.test(path)) {
      // locale duplicate such as /fr/ or /en-gb/pricing: keep only if nothing else exists
      path = path.replace(LOCALE, '/') ; if (path === '/') continue;
      l = Object.assign({}, l, { locale: true });
    }
    const top = '/' + path.split('/').filter(Boolean)[0];
    const depth = path.split('/').filter(Boolean).length;
    const prev = seen.get(u.href) || { n: 0, nav: false, footer: false, text: l.text };
    prev.n++; prev.nav = prev.nav || l.nav; prev.footer = prev.footer || l.footer;
    if (!prev.text && l.text) prev.text = l.text;
    seen.set(u.href, prev);
    let score = 0;
    const reasons = [];
    if (l.nav) { score += 5; reasons.push('nav'); }
    if (HIGH.test(path) || HIGH.test(l.text || '')) { score += 4; reasons.push('key page'); }
    if (l.footer && !l.nav) { score += 0.5; reasons.push('footer'); }
    score -= (depth - 1) * 1.5;
    if (l.locale) { score -= 6; reasons.push('locale'); }
    if (u.search) score -= 1;
    const cur = byPath.get(top);
    const total = score + Math.min(prev.n, 4) * 0.5;
    if (!cur || total > cur.score || (total === cur.score && depth < cur.depth)) {
      byPath.set(top, { url: u.origin + u.pathname, path, top, score: Math.round(total * 10) / 10, reasons, text: prev.text || '', depth });
    }
  }
  const ranked = Array.from(byPath.values()).sort((a, b) => b.score - a.score);
  const strong = ranked.filter((p) => p.score >= 2);
  return (strong.length >= 3 ? strong : ranked).slice(0, max);
}

if (typeof module !== 'undefined') module.exports = { scoreLinks };
