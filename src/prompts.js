'use strict';
const fs = require('fs');
const C = require('./color');
const { readJSON } = require('./util');

const SUFFIX = 'photorealistic, no text, letters, logos, brand marks, cards or app screens';

function colourName(hex) {
  const { L, C: c, H } = C.oklch(hex);
  if (c < 0.03) return L > 0.93 ? 'white' : L > 0.75 ? 'light grey' : L > 0.45 ? 'mid grey' : L > 0.2 ? 'charcoal' : 'black';
  const hues = [[20, 'pink'], [45, 'red'], [70, 'orange'], [105, 'yellow'], [150, 'green'], [200, 'teal'], [265, 'blue'], [310, 'violet'], [350, 'magenta'], [361, 'pink']];
  const name = hues.find(([h]) => H < h)[1];
  return (L < 0.4 ? 'deep ' : L > 0.82 ? 'pale ' : '') + name;
}

// Draft prompts from the measured imagery. New subjects, the site's photographic style.
function buildPrompts(a, existingPath) {
  if (existingPath && fs.existsSync(existingPath)) {
    const old = readJSON(existingPath);
    if (old.locked) return old; // reviewed by hand: keep as is
  }
  const R = a.colour.roles;
  const palette = [...new Set([R.background.hex, R['surface-inverse'].hex, R.action.hex, R.accent.hex].map(colourName))].join(', ');
  const low = a.layout.darkShare > 0.4;
  const light = low ? 'low-key lighting with deep, clean shadows' : 'bright, soft natural daylight';
  const crop = (a.imagery.crops[0] || ['wide'])[0];
  const themes = a.imagery.altThemes.slice(0, 3).map(([w]) => w).join(', ') || 'everyday work and places';
  const style = `Editorial photography, ${light}, restrained palette of ${palette}, calm composition, generous negative space, typical crop ${crop}`;
  const slots = [
    ['hero', '16:9', 2000, 'cover', `Wide establishing photograph evoking ${themes}, people small in the frame, open sky or ceiling above for a headline`],
    ['horizon', '16:9', 2000, 'typography chapter', 'Minimal horizon, a flat landscape meeting a clear sky, long exposure, a single low line across the frame'],
    ['object', '4:5', 1400, 'colour chapter', `Studio render of an abstract sculptural object in ${colourName(R.accent.hex)} and ${colourName(R.surface.hex)} on a seamless backdrop, soft rim light`],
    ['street', '4:5', 1400, 'voice chapter', `Candid lifestyle photograph on a city street, shallow depth of field, moment of everyday life related to ${themes}`],
    ['sky', '16:9', 2000, 'clean background', `Clean sky background with soft gradient light and faint clouds in ${colourName(R.background.hex)} and ${colourName(R.accent.hex)} tones`],
    ['glass', '4:5', 1400, 'components chapter', `Orderly arrangement of frosted glass panels and rounded tiles, macro, precise geometry, ${colourName(R.action.hex)} light passing through`],
    ['grid', '1:1', 1400, 'layout chapter', `Top-down photograph of identical objects aligned on a strict grid on a ${colourName(R.surface.hex)} surface, even spacing`],
    ['tokens', '16:9', 2000, 'tokens chapter', `Abstract macro of translucent colour swatches in a row, ${palette}, shallow focus`],
    ['detail', '4:5', 1400, 'imagery mosaic', `Close-up detail photograph of hands at work, textures of paper, wood and fabric, related to ${themes}`],
  ].map(([slot, aspectRatio, width, use, subject]) => ({ slot, aspectRatio, width, use, prompt: `${subject}. ${style}. ${SUFFIX}.` }));
  return { brand: a.brand, source: a.url, style, suffix: SUFFIX, locked: false, note: 'Set "locked": true after reviewing to keep your edits on the next run.', slots };
}

module.exports = { buildPrompts, colourName, SUFFIX };
