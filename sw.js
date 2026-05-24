const CBE_CACHE_VERSION = '20260524_ui_refine_nonav_clean1';
const STATIC_CACHE = `cbe-static-${CBE_CACHE_VERSION}`;
const HTML_CACHE = `cbe-html-${CBE_CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './login.html',
  './menu.html',
  './cart.html',
  './track.html',
  './profile.html',
  './track-fullscreen.html',
  './order_placed.html',
  './pwa-speed.js?v=20260524_ui_refine_nonav_clean1',
  './firebase-config.js',
  './firebase-mvp.js',
  './ola-map-v4.js?v=20260523_appfeel1',
  './assets/cart/dish-img.png',
  './assets/track orders/track-img.svg',
  './assets/menu/icons/user profile.svg',
  './assets/menu/icons/pen-icon.svg',
  './assets/menu/icons/arrow-right-icon.svg',
  './assets/menu/img/Protein egg lunch-img.png',
  './assets/menu/img/Protein chicken lunch-img.png',
  './assets/menu/img/Regular meal-img.png',
  './assets/menu/img/Chappati & gravy-img.png',
  './assets/menu/img/hero card-img.png',
  './assets/menu/img/tab1-img.png',
  './assets/menu/img/tab2-img.png',
  './assets/menu/img/tab3-img.png',
  './fonts/GeneralSans/GeneralSans-Regular.otf',
  './fonts/GeneralSans/GeneralSans-Medium.otf',
  './fonts/GeneralSans/GeneralSans-Semibold.otf',
  './fonts/GeneralSans/GeneralSans-Bold.otf'
];

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
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('cbe-') && key !== STATIC_CACHE && key !== HTML_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isHtmlRequest(request) {
  return request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');
}

function shouldNetworkOnly(url) {
  return url.pathname.startsWith('/ola-maps') ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('/__/') ||
    url.searchParams.has('api_key') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com');
}

async function htmlAppLike(request, event) {
  const cache = await caches.open(HTML_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(response => {
      if (response && response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkPromise);
    return cached;
  }

  const response = await networkPromise;
  if (response) return response;
  return caches.match('./menu.html');
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkPromise);
    return cached;
  }

  const response = await networkPromise;
  if (response) return response;
  return fetch(request);
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  if (shouldNetworkOnly(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isHtmlRequest(request)) {
    event.respondWith(htmlAppLike(request, event));
    return;
  }

  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.otf')
  ) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
