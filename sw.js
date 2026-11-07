// Keeps Bustan working offline: the app itself, plus mushaf pages, fonts and tafsir you've opened.
const APP = 'bustan-app-v5';
const DATA = 'bustan-data-v1';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/main.js', 'js/store.js', 'js/planner.js', 'js/data.js',
  'js/mushaf.js', 'js/player.js', 'js/scene.js', 'data/meta.json', 'manifest.webmanifest', 'icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== APP && k !== DATA).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (/\.mp3$/.test(url.pathname)) return; // audio streams straight from the reciter's server
  const cacheable = url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'raw.githubusercontent.com' ||
    url.hostname.endsWith('gstatic.com') || url.hostname === 'fonts.googleapis.com' || url.hostname === 'www.mp3quran.net' ||
    url.pathname.includes('/data/timings/');
  if (cacheable) {
    // cache first: mushaf pages, fonts, tafsir and timings never change
    e.respondWith(caches.open(DATA).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin === location.origin) {
    // network first for the app, so updates arrive; fall back to the saved copy offline
    // always ask the server for the newest copy (skips the browser's 10-minute cache)
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(APP).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
  }
});
