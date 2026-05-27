(() => {
  const SPEED_VERSION = '20260527_customer_prod_ready_fix2';
  const APP_CACHE_NAMES = [`cbe-static-${SPEED_VERSION}`, `cbe-html-${SPEED_VERSION}`];
  const APP_CACHE_PREFIXES = ['cbe-static-', 'cbe-html-', 'cbe-runtime-', 'cbe-map-', 'cbe-tiles-', 'maplibre-', 'ola-'];
  const LARGE_PROFILE_KEYS = [
    'TIFFIN_CUSTOMER_AVATAR','CBE_CUSTOMER_AVATAR','cbe_customer_avatar','customer_avatar','cust_avatar','profile_avatar','customer_profile_photo','cust_profile_photo','profile_photo','customerProfilePhoto','customer_photo','cust_photo','user_photo','TIFFIN_PROFILE_PHOTO'
  ];
  let prefetched = new Set();
  let isNavigating = false;

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function safeStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      cleanupLargeLocalStorage();
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (_) {
        console.warn('Local storage write skipped', key, error);
        return false;
      }
    }
  }

  function cleanupLargeLocalStorage() {
    try {
      LARGE_PROFILE_KEYS.forEach(key => localStorage.removeItem(key));
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('firestore_mutations_') || key.startsWith('firestore_sequence_number_')) localStorage.removeItem(key);
        if (/avatar|photo|image/i.test(key)) {
          const value = localStorage.getItem(key) || '';
          if (value.length > 250000 && key !== 'TIFFIN_CUSTOMER_PROFILE' && key !== 'customerProfile' && key !== 'CBE_CUSTOMER_PROFILE') localStorage.removeItem(key);
        }
      });
    } catch (_) {}
  }

  function injectAppFeelCss() {
    if (document.getElementById('cbe-app-feel-style')) return;
    const style = document.createElement('style');
    style.id = 'cbe-app-feel-style';
    style.textContent = `
      html{min-height:100%;-webkit-tap-highlight-color:transparent}
      body{min-height:100%;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
      body.cbe-page-leaving{opacity:.92;transform:translate3d(-6px,0,0);transition:opacity 110ms ease,transform 110ms ease;pointer-events:none}
      button,a,[role="button"]{touch-action:manipulation}
      @media (prefers-reduced-motion:reduce){body.cbe-page-leaving{transition:none!important;transform:none!important}}
    `;
    document.head.appendChild(style);
  }

  function safeUrl(href) {
    try { return new URL(href, window.location.href); } catch (_) { return null; }
  }

  function isSameOriginLocalUrl(url) {
    return url && url.origin === window.location.origin;
  }

  function isHtmlLikeUrl(url) {
    if (!url) return false;
    const path = url.pathname || '';
    if (path.endsWith('/')) return true;
    return /\.(html?)$/i.test(path);
  }

  function isCurrentPage(url) {
    return url && url.origin === window.location.origin && url.pathname === window.location.pathname && url.search === window.location.search && (!url.hash || url.hash === window.location.hash);
  }

  function addPreconnect(href) {
    if (!href || document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    link.crossOrigin = '';
    document.head.appendChild(link);
  }

  function prefetchLink(url, asType) {
    const target = typeof url === 'string' ? url : url?.href;
    if (!target || prefetched.has(target)) return;
    prefetched.add(target);
    if (document.querySelector(`link[rel="prefetch"][href="${target}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = target;
    if (asType) link.as = asType;
    document.head.appendChild(link);
  }

  function warmUrl(url) {
    if (!isSameOriginLocalUrl(url) || !isHtmlLikeUrl(url)) return;
    prefetchLink(url.href, 'document');
  }

  function warmMapShellIfUseful() {
    const route = (window.location.pathname.split('/').pop() || 'menu.html').toLowerCase();
    if (!['menu.html','cart.html','profile.html','track-fullscreen.html'].includes(route)) return;
    addPreconnect('https://unpkg.com');
    addPreconnect('https://api.olamaps.io');
  }

  function cartHasItems() {
    try {
      const raw = localStorage.getItem('cart');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      return items.some(item => Number(item?.qty ?? item?.quantity ?? item?.count ?? 0) > 0);
    } catch (_) { return false; }
  }

  function warmRazorpayIfUseful() {
    const route = (window.location.pathname.split('/').pop() || '').toLowerCase();
    if (route !== 'cart.html' || !cartHasItems()) return;
    addPreconnect('https://checkout.razorpay.com');
  }

  function shouldSkipTransitionForAnchor(anchor, event) {
    if (!anchor || event.defaultPrevented) return true;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1) return true;
    if (anchor.target && anchor.target !== '_self') return true;
    if (anchor.hasAttribute('download')) return true;
    if (anchor.dataset.noTransition === 'true' || anchor.getAttribute('data-no-transition') === 'true') return true;
    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#')) return true;
    if (/^(tel|sms|mailto|javascript):/i.test(href)) return true;
    const url = safeUrl(href);
    if (!isSameOriginLocalUrl(url) || !isHtmlLikeUrl(url)) return true;
    return false;
  }

  function handlePotentialWarmup(event) {
    const anchor = event.target.closest?.('a[href]');
    if (!anchor) return;
    warmUrl(safeUrl(anchor.href));
  }

  function handleNavigationClick(event) {
    const anchor = event.target.closest?.('a[href]');
    if (shouldSkipTransitionForAnchor(anchor, event)) return;
    const url = safeUrl(anchor.href);
    if (!url) return;
    if (isCurrentPage(url)) {
      event.preventDefault();
      window.CoimbatoreFoodsBottomNav?.refresh?.();
      return;
    }
    event.preventDefault();
    if (isNavigating) return;
    isNavigating = true;
    anchor.classList.add('is-pressing');
    warmUrl(url);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) document.body.classList.add('cbe-page-leaving');
    window.setTimeout(() => window.location.assign(url.href), reducedMotion ? 0 : 85);
  }

  function cleanOldCaches() {
    if (!('caches' in window)) return Promise.resolve();
    return caches.keys().then(keys => Promise.all(keys.map(key => {
      const isAppCache = APP_CACHE_PREFIXES.some(prefix => key.startsWith(prefix));
      if (isAppCache && !APP_CACHE_NAMES.includes(key)) return caches.delete(key);
      return Promise.resolve(false);
    }))).catch(() => null);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`sw.js?v=${SPEED_VERSION}`).then(registration => {
        registration.update?.();
        if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'CBE_CLEAN_CACHES' });
        cleanOldCaches();
      }).catch(() => cleanOldCaches());
    });
  }

  function runWhenIdle(callback, timeout = 900) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(callback, { timeout });
      return;
    }
    setTimeout(callback, Math.min(timeout, 700));
  }

  function boot() {
    cleanupLargeLocalStorage();
    injectAppFeelCss();
    document.body?.classList.remove('cbe-page-leaving');
    document.body?.classList.add('pwa-speed-ready');
    document.addEventListener('click', handleNavigationClick, true);
    document.addEventListener('touchstart', handlePotentialWarmup, { passive: true, capture: true });
    document.addEventListener('pointerenter', handlePotentialWarmup, { passive: true, capture: true });
    document.addEventListener('focusin', handlePotentialWarmup, true);
    runWhenIdle(() => {
      cleanOldCaches();
      warmMapShellIfUseful();
      warmRazorpayIfUseful();
    }, 900);
  }

  cleanupLargeLocalStorage();
  registerServiceWorker();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.addEventListener('pageshow', () => {
    isNavigating = false;
    document.body?.classList.remove('cbe-page-leaving');
    document.querySelectorAll('.is-pressing').forEach(el => el.classList.remove('is-pressing'));
    window.CoimbatoreFoodsBottomNav?.refresh?.();
  });

  window.CBEPWASpeed = {
    version: SPEED_VERSION,
    safeStorageGet,
    safeStorageSet,
    cleanupLargeLocalStorage,
    cleanOldCaches,
    warmMapShellIfUseful,
    warmRazorpayIfUseful,
    warmUrl: href => warmUrl(safeUrl(href))
  };
})();
