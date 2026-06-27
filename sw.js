const CACHE = 'road-to-980-v2-3-svg-flags';
const ASSETS = ['./','./index.html','./styles.css?v=2.3','./data.js?v=2.3','./app.js?v=2.3','./manifest.webmanifest','./assets/icons/icon-192.svg','./assets/icons/icon-512.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isAppFile = url.pathname.endsWith('/') || ['index.html','styles.css','data.js','app.js','sw.js'].some(file => url.pathname.endsWith(file));
  if(isAppFile){
    event.respondWith(fetch(event.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(event.request, copy)); return res; }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
