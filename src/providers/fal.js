'use strict';
// fal.ai queue adapter. Submit returns a request id that the ledger saves before polling.
const fs = require('fs');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const MODEL = process.env.FAL_MODEL || 'fal-ai/flux-pro/v1.1-ultra';
const RATIOS = { '16:9': '16:9', '4:5': '4:5', '1:1': '1:1', '21:9': '21:9', '3:4': '3:4', '9:16': '9:16' };
const headers = (key) => ({ Authorization: `Key ${key}`, 'Content-Type': 'application/json' });

module.exports = {
  envKey: 'FAL_KEY',
  price: +(process.env.FAL_PRICE || 0.06), // USD per image; check current pricing for the model
  async balance() { return { ok: true, amount: null, note: 'fal has no public balance endpoint; capped by --max-cost' }; },
  async submit(key, { prompt, aspectRatio }) {
    const r = await fetch(`https://queue.fal.run/${MODEL}`, { method: 'POST', headers: headers(key), body: JSON.stringify({ prompt, aspect_ratio: RATIOS[aspectRatio] || '16:9', num_images: 1, output_format: 'png', enable_safety_checker: true }) });
    if (!r.ok) throw new Error(`fal submit ${r.status}`);
    const j = await r.json();
    return { id: j.request_id, statusUrl: j.status_url, responseUrl: j.response_url, model: MODEL };
  },
  async wait(key, job) {
    for (let i = 0; i < 180; i++) {
      const r = await fetch(job.statusUrl, { headers: headers(key) });
      const s = await r.json();
      if (s.status === 'COMPLETED') break;
      if (s.status === 'FAILED' || s.status === 'ERROR') throw new Error('fal job failed');
      await new Promise((res) => setTimeout(res, 2000));
    }
    const r = await fetch(job.responseUrl, { headers: headers(key) });
    const j = await r.json();
    if (!j.images || !j.images[0]) throw new Error('fal returned no image');
    return { url: j.images[0].url };
  },
  async download(key, result, dst) {
    const r = await fetch(result.url);
    if (!r.ok) throw new Error(`download ${r.status}`);
    await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(dst));
  },
};
