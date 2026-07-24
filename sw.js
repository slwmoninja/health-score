// Deliberately does nothing but pass requests straight to the network — no
// caching, no offline fallback. Its only purpose is to satisfy Chrome's
// installability requirement for a real "Install app" / Add-to-Home-Screen
// flow on Android, which is what gives the site Chrome's strongest storage-
// durability tier (installed apps are far less likely to have their data
// silently evicted under storage pressure than a plain bookmarked tab).
// index.html's own checkForUpdate() already handles fetching the latest
// deploy with cache:'no-store' — this worker must never cache anything or it
// would fight that mechanism and serve stale versions.
self.addEventListener('install', ()=>{ self.skipWaiting(); });
self.addEventListener('activate', (e)=>{ e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e)=>{ e.respondWith(fetch(e.request)); });
