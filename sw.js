// Service worker sederhana: simpan file aplikasi agar cepat dibuka.
// Data (Supabase) selalu diambil langsung dari internet.
const CACHE = 'mdxl-demo-v1';
const SHELL = ['./', './index.html', './css/app.css', './icon.svg', './manifest.webmanifest',
  './js/main.js', './js/ui.js', './js/db.js', './js/camera.js', './js/activities.js', './js/visits.js', './js/config.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // network-first agar perubahan kode langsung terlihat setelah deploy
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request)));
});
