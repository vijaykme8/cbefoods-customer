const P260526_order_persist_fix2';
const STATIC_CACHE = `cbe-static-${CBE_CACHE_VERSION}`;
const HTML_CACHE = `cbe-html-${CBE_CACHE_VERSION}`;
const CACHE_PREFIXES = ['cbe-static-', 'cbe-html-', 'cbe-runtime-', 'cbe-map-', 'cbe-tiles-', 'maplibre-', 'ola-'];

const PRECACHE_URLS = [
  './',
  './index.html',
  './login.html',
  './menu.html',
  './cart.html',
  './profile.html',
  './track-fullscreen.html',
  './order_placed.html',
  './pwa-speed.js?v=20260526_order_persist_fix2',
  './firebase-config.js',
  './firebase-mvp.js',
  './assets/cart/dish-img.png',
  './fonts/GeneralSans/GeneralSans-Regular.otf',
  './fonts/GeneralSans/GeneralSans-Medium.otf',
  './fonts/GeneralSans/GeneralSans-Semibold.otf'
];

function cacheBelongsToApp(key) {
  return CACHE_PREFIXES.some(prefix => key.startsWith(prefix));
}

function isCurrentCache(key) {
  return key === STATIC_CACHE || key === HTML_CACHE;
}

async function cleanOldCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.map(key => {
    if (cacheBelongsToApp(key) && !isCurrentCache(key)) return caches.delete(key);
    return Promise.resolve(false);
  }));
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      )
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(cleanOldCaches().then(() => self.clients.claim()));
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isHtmlRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

function isMapOrHeavyRequest(url, request) {
  const path = url.pathname.toLowerCase();
  const host = url.hostname.toLowerCase();
  const query = url.search.toLowerCase();
  return path.startsWith('/ola-maps') ||
    path.includes('/tiles') ||
    path.includes('/tile') ||
    path.includes('/vector') ||
    path.includes('/raster') ||
    path.includes('/routing') ||
    path.includes('/directions') ||
    path.includes('style.json') ||
    path.includes('sprite') ||
    path.includes('glyphs') ||
    query.includes('api_key') ||
    host.includes('olamaps') ||
    host.includes('mapbox') ||
    host.includes('maplibre') ||
    request.destination === 'video' ||
    request.destination === 'audio';
}

function shouldNetworkOnly(url, request) {
  return isMapOrHeavyRequest(url, request) ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('/__/') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('checkout.razorpay.com');
}

async function networkFirstHtml(request) {
  const cache = await caches.open(HTML_CACHE);
  try {
    const response = await fetch(new Request(request, { cache: 'no-store' }));
    if (response && response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return caches.match('./menu.html');
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request).then(response => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  if (cached) {
    event.waitUntil(networkPromise);
    return cached;
  }

  const response = await networkPromise;
  if (response) return response;
  return fetch(request);
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CBE_CLEAN_CACHES') {
    event.waitUntil(cleanOldCaches());
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (shouldNetworkOnly(url, request)) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (!isSameOrigin(url)) return;

  if (isHtmlRequest(request)) {
    event.respondWith(networkFirstHtml(request));
    return;
  }

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.otf')
  ) {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  if (
    request.destination === 'image' ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
