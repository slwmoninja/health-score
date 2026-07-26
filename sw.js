// Precaches the app shell and serves it cache-first with a background network
// refresh (stale-while-revalidate) — the point is a fast, offline-capable load
// on a bad cell connection instead of every single open re-downloading the
// whole app. Every real fetch (any time the app is opened online) refreshes
// the cached copy in the background for next time, so the cache stays
// reasonably current on its own without needing a manual version bump here
// whenever a precached file changes.
//
// This does NOT fight index.html's own checkForUpdate() (a separate check
// that does a HEAD request with cache:'no-store' + a cache-busting query
// string, comparing etag/last-modified, and force-reloading on a mismatch) —
// that request is excluded below (method!=='GET') and always goes straight to
// the network untouched, so staleness still gets caught and reloaded exactly
// as before. The one edge case: right after a brand-new deploy, the very next
// open of the app may show the previous version for a moment (served from
// cache) while the cache quietly updates in the background — checkForUpdate's
// next check (on the following visibilitychange) will catch that and reload,
// and that reload's own navigation fetch is what refreshes the cache, so it
// self-heals within at most one extra reload rather than getting stuck.
const CACHE_NAME = 'hs-shell-v1';
const PRECACHE_URLS = [
  './index.html', './manifest.json',
  './HealthScore.png', './ProfileIcons.png', './btn-nutrition.png', './btn-activity.png',
  './icon-192.png', './icon-512.png'
];

self.addEventListener('install', (e)=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(PRECACHE_URLS)).catch(()=>{}));
});
self.addEventListener('activate', (e)=>{
  e.waitUntil((async ()=>{
    const names = await caches.keys();
    await Promise.all(names.filter(n=>n!==CACHE_NAME).map(n=>caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e)=>{
  const req = e.request;
  const url = new URL(req.url);
  // Anything that isn't a same-origin GET (checkForUpdate's HEAD ping, every
  // cross-origin call to USDA FDC/Google Health/Fitbit, POSTs) passes straight
  // through untouched — same as the old no-op worker's behavior for these.
  if(req.method!=='GET' || url.origin!==location.origin){
    e.respondWith(fetch(req));
    return;
  }
  e.respondWith((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    // A navigation (opening the app fresh, or the reload checkForUpdate triggers)
    // should resolve to the cached shell regardless of the exact URL requested
    // (bare site root vs. an explicit .../index.html) — this is what makes a
    // fresh open/relaunch instant instead of blocked on the network.
    const cacheKey = req.mode==='navigate' ? './index.html' : req;
    const cached = await cache.match(cacheKey);
    const networkFetch = fetch(req).then(res=>{
      if(res && res.ok) cache.put(cacheKey, res.clone());
      return res;
    }).catch(()=>null);
    if(cached){ e.waitUntil(networkFetch); return cached; }
    return (await networkFetch) || Response.error();
  })());
});
