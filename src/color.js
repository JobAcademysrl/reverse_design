'use strict';
// Colour maths in Node: hex <-> sRGB, OKLab/OKLCH, WCAG contrast.

function parseHex(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
}

function toHex({ r, g, b, a = 1 }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b) + (a < 1 ? c(a * 255) : '');
}

const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };

function oklab(hex) {
  const { r, g, b } = parseHex(hex);
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklch(hex) {
  const { L, a, b } = oklab(hex);
  const C = Math.sqrt(a * a + b * b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H: C < 0.002 ? 0 : H };
}

function oklchString(hex) {
  const { L, C, H } = oklch(hex);
  const { a } = parseHex(hex);
  const alpha = a < 1 ? ` / ${+a.toFixed(2)}` : '';
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)}${alpha})`;
}

function luminance(hex) {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function distance(a, b) {
  const x = oklab(a), y = oklab(b);
  return Math.sqrt((x.L - y.L) ** 2 + (x.a - y.a) ** 2 + (x.b - y.b) ** 2);
}

// Composite a translucent colour over an opaque ground.
function over(hex, groundHex) {
  const c = parseHex(hex), g = parseHex(groundHex || '#ffffff');
  if (c.a >= 1) return toHex(c);
  return toHex({ r: c.r * c.a + g.r * (1 - c.a), g: c.g * c.a + g.g * (1 - c.a), b: c.b * c.a + g.b * (1 - c.a) });
}

const opaque = (hex) => toHex({ ...parseHex(hex), a: 1 });
const alpha = (hex) => parseHex(hex).a;
const isDark = (hex) => oklch(hex).L < 0.6;

function mix(a, b, t) {
  const x = parseHex(a), y = parseHex(b);
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

function wcag(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA large';
  return 'fail';
}

module.exports = { parseHex, toHex, oklab, oklch, oklchString, luminance, contrast, distance, over, opaque, alpha, isDark, mix, wcag };
