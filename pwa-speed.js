(() => {
  const SPEED_VERSION = '20260512_speed1';

  const CORE_PAGES = [
    'menu.html',
    'cart.html',
    'track.html'
  ];

  const IMAGE_ASSETS = [
    'assets/cart/dish-img.png',
    'assets/menu/img/Protein egg lunch-img.png',
    'assets/menu/img/Protein chicken lunch-img.png',
    'assets/menu/img/Regular meal-img.png',
    'assets/menu/img/Chappati & gravy-img.png',
    'assets/menu/img/hero card-img.png',
    'assets/menu/img/tab1-img.png',
    'assets/menu/img/tab2-img.png',
    'assets/menu/img/tab3-img.png'
  ];

  const FONT_ASSETS = [
    'fonts/GeneralSans/GeneralSans-Regular.otf',
    'fonts/GeneralSans/GeneralSans-Medium.otf',
    'fonts/GeneralSans/GeneralSans-Semibold.otf'
  ];

  function routeName() {
    return (window.location.pathname.split('/').pop() || 'menu.html').replace(/\.html$/i, '').toLowerCase();
  }

  function safeJSON(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function cartHasItems() {
    const raw = localStorage.getItem('cart');
    if (!raw) return false;

    const parsed = safeJSON(raw, []);
    const items = Array.isArray(parsed) ? parsed : Object.values(parsed || {});

    return items.some(item => Number(item?.qty ?? item?.quantity ?? item?.count ?? 1) > 0);
  }

  function addPreconnect(href) {
    if (!href) return;
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    link.crossOrigin = '';
    document.head.appendChild(link);
  }

  function prefetchUrl(url, asType) {
    if (!url) return;
    if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    if (asType) link.as = asType;
    document.head.appendChild(link);
  }

  function preloadImage(src) {
    if (!src) return;
    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = src;
  }

  function preloadScript(src, id) {
    return new Promise((resolve, reject) => {
      if (!src) return resolve();
      if (id && document.getElementById(id)) return resolve();

      const existing = Array.from(document.scripts).find(script => (script.src || '').includes(src));
      if (existing) return resolve();

      const script = document.createElement('script');
      if (id) script.id = id;
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Could not preload ${src}`));
      document.head.appendChild(script);
    });
  }

  function warmStaticAssets() {
    CORE_PAGES.forEach(page => prefetchUrl(page, 'document'));
    IMAGE_ASSETS.forEach(preloadImage);
    FONT_ASSETS.forEach(font => prefetchUrl(font, 'font'));
    prefetchUrl('components/bottom-nav.css?v=20260511_nav2', 'style');
    prefetchUrl('components/bottom-nav.js?v=20260511_nav2', 'script');
    prefetchUrl('firebase-config.js', 'script');
    prefetchUrl('firebase-mvp.js', 'script');
  }

  function warmRazorpayIfUseful() {
    if (routeName() !== 'cart') return;
    if (!cartHasItems()) return;

    addPreconnect('https://checkout.razorpay.com');
    preloadScript('https://checkout.razorpay.com/v1/checkout.js', 'razorpay-prewarm')
      .catch(() => {
        // Razorpay will still be retried when user taps Place order.
      });
  }

  function warmMapShellIfUseful() {
    /*
      We do NOT render a hidden Ola map because that may trigger map/tile/API calls.
      This only preloads local map wrapper and connects early, so the address screen opens smoother.
    */
    const route = routeName();
    if (route !== 'menu' && route !== 'cart') return;

    addPreconnect('https://unpkg.com');
    addPreconnect('https://api.olamaps.io');
    prefetchUrl('ola-map-v4.js', 'script');
    prefetchUrl('https://unpkg.com/maplibre-gl@5.9.0/dist/maplibre-gl.css', 'style');
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`sw.js?v=${SPEED_VERSION}`).catch(() => {
        // App still works without service worker.
      });
    });
  }

  function markReady() {
    document.documentElement.classList.add('pwa-speed-ready');
    document.body?.classList.add('pwa-speed-ready');
  }

  function runWhenIdle(callback, timeout = 900) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(callback, { timeout });
      return;
    }

    setTimeout(callback, Math.min(timeout, 700));
  }

  registerServiceWorker();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markReady, { once: true });
  } else {
    markReady();
  }

  runWhenIdle(() => {
    warmStaticAssets();
    warmMapShellIfUseful();
    warmRazorpayIfUseful();
  }, 1000);

  window.CBEPWASpeed = {
    version: SPEED_VERSION,
    warmStaticAssets,
    warmMapShellIfUseful,
    warmRazorpayIfUseful
  };
})();
