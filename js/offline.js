// Offline recitations: download a surah once, then it plays with no internet.
// Files are kept in the browser's Cache Storage and played from a local blob URL, which seeks smoothly.
import { RECITERS } from './player.js';
import { surah } from './data.js';

const CACHE = 'bustan-audio-v1';
const pad3 = (n) => String(n).padStart(3, '0');
const blobUrls = new Map();

function filesFor(recId, s) {
  const rec = RECITERS[recId];
  if (rec.kind === 'timed') return [rec.audio(s)];
  const out = []; for (let a = 1; a <= surah(s).verses; a++) out.push(rec.audio(s, a));
  return out;
}

// A local copy of this audio file if it was downloaded, else null.
export async function localUrl(url) {
  if (blobUrls.has(url)) return blobUrls.get(url);
  if (!('caches' in window)) return null;
  try {
    const c = await caches.open(CACHE);
    const hit = await c.match(url);
    if (!hit) return null;
    const u = URL.createObjectURL(await hit.blob());
    blobUrls.set(url, u);
    return u;
  } catch (e) { return null; }
}

export async function downloaded() {
  // { 'sufi:5': bytes }
  const out = {};
  if (!('caches' in window)) return out;
  const c = await caches.open(CACHE);
  for (const req of await c.keys()) {
    const m = req.url.match(/#bustan=(\w+):(\d+)$/);
    if (m) { const r = await c.match(req); out[`${m[1]}:${m[2]}`] = +(r.headers.get('x-bytes') || 0); }
  }
  return out;
}

export async function download(recId, s, onProgress = () => {}) {
  const rec = RECITERS[recId];
  if (rec.missing?.includes(s)) throw new Error('missing');
  try { await navigator.storage?.persist?.(); } catch (e) { /* fine */ }
  const c = await caches.open(CACHE);
  const files = filesFor(recId, s);
  let total = 0;
  for (let i = 0; i < files.length; i++) {
    const url = files[i];
    if (await c.match(url)) { onProgress((i + 1) / files.length); continue; }
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('http ' + res.status);
    const len = +res.headers.get('content-length') || 0;
    // read with progress
    const reader = res.body.getReader(); const parts = []; let got = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      parts.push(value); got += value.length;
      if (len && files.length === 1) onProgress(got / len);
    }
    total += got;
    await c.put(url, new Response(new Blob(parts, { type: 'audio/mpeg' }), { headers: { 'content-type': 'audio/mpeg' } }));
    if (files.length > 1) onProgress((i + 1) / files.length);
  }
  // the ayah timings, so the loop works offline too
  if (rec.kind === 'timed') { try { await fetch(`data/timings/${recId}/${pad3(s)}.json`); } catch (e) { /* fine */ } }
  await c.put(`${location.origin}/offline#bustan=${recId}:${s}`, new Response('ok', { headers: { 'x-bytes': String(total) } }));
}

export async function removeDownload(recId, s) {
  const c = await caches.open(CACHE);
  for (const url of filesFor(recId, s)) { await c.delete(url); const b = blobUrls.get(url); if (b) { URL.revokeObjectURL(b); blobUrls.delete(url); } }
  await c.delete(`${location.origin}/offline#bustan=${recId}:${s}`);
}
