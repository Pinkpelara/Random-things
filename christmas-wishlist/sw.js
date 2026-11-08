/* Wishlist HQ offline support: the app opens instantly and works without internet.
   The page itself is network-first (so updates arrive), photos and icons are cache-first. */
const CACHE = 'wishlist-hq-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon.png', './icon-180.png', './icon-192.png', './icon-512.png',
  './santa/dribble.jpg', './santa/squishies2.jpg', './santa/nap.jpg', './santa/tea.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // chat requests to the AI services pass straight through
  const url = new URL(req.url);
  const isPage = req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname));
  if (isPage){
    e.respondWith((async () => {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
      try {
        const res = await fetch(req, {signal: ctl.signal}); clearTimeout(t);
        if (res && res.ok){ const c = await caches.open(CACHE); c.put('./index.html', res.clone()); }
        return res;
      } catch(err){
        clearTimeout(t);
        return (await caches.match('./index.html')) || (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|cdn\.gamma\.app/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')){ const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch(err){ return hit || Response.error(); }
  })());
});
