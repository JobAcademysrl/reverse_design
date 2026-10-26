'use strict';
// Self-contained CSS text scanner (also stringified into the DevTools snippet).
// Reads breakpoints, :root custom properties, @font-face family names and easings.

function parseCss(texts) {
  const out = { breakpoints: {}, rootVars: {}, fontFaces: {}, easings: {}, durations: {}, sheets: texts.length, bytes: 0 };
  const bump = (m, k) => { m[k] = (m[k] || 0) + 1; };
  for (const raw of texts) {
    const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    out.bytes += css.length;
    const mq = /@media[^{]*/g;
    let m;
    while ((m = mq.exec(css))) {
      const q = /(min|max)-width\s*:\s*([\d.]+)(px|em|rem)/g;
      let p;
      while ((p = q.exec(m[0]))) bump(out.breakpoints, p[1] + ':' + Math.round(parseFloat(p[2]) * (p[3] === 'px' ? 1 : 16)));
    }
    const rule = /([^{}]+)\{([^{}]*)\}/g;
    while ((m = rule.exec(css))) {
      const sel = m[1].trim();
      if (/^@font-face/.test(sel) || /@font-face\s*$/.test(sel)) {
        const fam = m[2].match(/font-family\s*:\s*["']?([^;"']+)/);
        const wt = m[2].match(/font-weight\s*:\s*([^;]+)/);
        if (fam) { const f = fam[1].trim(); (out.fontFaces[f] = out.fontFaces[f] || []).push(wt ? wt[1].trim() : '400'); }
        continue;
      }
      if (sel.split(',').some((s) => /^\s*(:root|html)(\[[^\]]*\])?\s*$/.test(s))) {
        const d = /(--[\w-]+)\s*:\s*([^;]+)/g;
        let v;
        while ((v = d.exec(m[2]))) if (!(v[1] in out.rootVars)) out.rootVars[v[1]] = v[2].trim().slice(0, 200);
      }
      const e = m[2].match(/cubic-bezier\([^)]*\)/g);
      if (e) e.forEach((x) => bump(out.easings, x.replace(/\s+/g, '')));
      const t = m[2].match(/transition(?:-duration)?\s*:[^;]*?(\d*\.?\d+m?s)/);
      if (t) bump(out.durations, t[1]);
    }
  }
  return out;
}

if (typeof module !== 'undefined') module.exports = { parseCss };
