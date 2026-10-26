'use strict';
// OpenAI Images adapter. The call is synchronous, so the ledger stores a local id
// before the request and the image is written to disk as soon as it returns.
const fs = require('fs');
const crypto = require('crypto');

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const SIZES = { '16:9': '1536x1024', '21:9': '1536x1024', '4:5': '1024x1536', '3:4': '1024x1536', '9:16': '1024x1536', '1:1': '1024x1024' };

module.exports = {
  envKey: 'OPENAI_API_KEY',
  price: +(process.env.OPENAI_IMAGE_PRICE || 0.17), // USD per high-quality image; check current pricing
  async balance() { return { ok: true, amount: null, note: 'OpenAI has no balance endpoint; capped by --max-cost' }; },
  async submit(key, { prompt, aspectRatio }) {
    return { id: 'local-' + crypto.randomUUID(), size: SIZES[aspectRatio] || '1536x1024', model: MODEL, prompt };
  },
  async wait(key, job) {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: job.model, prompt: job.prompt, size: job.size, quality: 'high', n: 1 }),
    });
    if (!r.ok) throw new Error(`openai ${r.status}`);
    const j = await r.json();
    job.remoteId = r.headers.get('x-request-id');
    return { b64: j.data[0].b64_json };
  },
  async download(key, result, dst) { fs.writeFileSync(dst, Buffer.from(result.b64, 'base64')); },
};
