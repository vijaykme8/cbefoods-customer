(() => {
  const SPEED_VERSION = '20260526_track_ui_refine1';
  const APP_PAGES = [
    'menu.html',
    'cart.html',
    'profile.html',
    'track-fullscreen.html',
    'order_placed.html'
  ];
  const NAV_ICON_ASSETS = [];

  const IMAGE_ASSETS = [
    'assets/cart/dish-img.png',
    'assets/menu/icons/user profile.svg',
    'assets/menu/icons/pen-icon.svg',
    'assets/menu/icons/arrow-right-icon.svg',
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
    'fonts/GeneralSans/GeneralSans-Semibold.otf',
    'fonts/GeneralSans/GeneralSans-Bold.otf'
  ];

  const LOCAL_ASSETS = [
    ...APP_PAGES,
    ...NAV_ICON_ASSETS,
    ...IMAGE_ASSETS,
    ...FONT_ASSETS,
    'ola-map-v4.js?v=20260523_appfeel1',
    'firebase-config.js',
    'firebase-mvp.js'
  ];

  let prefetched = new Set();
  let isNavigating = false;

  function injectAppFeelCss() {
    if (document.getElementById('cbe-app-feel-style')) return;
    const style = document.createElement('style');
    style.id = 'cbe-app-feel-style';
    style.textContent = `
      html {
        min-height: 100%;
        -webkit-tap-highlight-color: transparent;
      }
      body {
        min-height: 100%;
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
      }
      body.cbe-page-leaving {
        opacity: 0.92;
        transform: translate3d(-6px, 0, 0);
        transition: opacity 110ms ease, transform 110ms ease;
        pointer-events: none;
      }
      button,
      a,
      [role="button"] {
        touch-action: manipulation;
      }
      @media (prefers-reduced-motion: reduce) {
        body.cbe-page-leaving {
          transition: none !important;
          transform: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function safeUrl(href) {
    try {
      return new URL(href, window.location.href);
    } catch {
      return null;
    }
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
    if (!url) return false;
    return url.origin === window.location.origin &&
      url.pathname === window.location.pathname &&
      url.search === window.location.search &&
      (!url.hash || url.hash === window.location.hash);
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

  function warmFetch(url) {
    const target = typeof url === 'string' ? url : url?.href;
    if (!target || prefetched.has(`fetch:${target}`)) return;
    prefetched.add(`fetch:${target}`);
    try {
      fetch(target, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'force-cache',
        priority: 'low'
      }).catch(() => null);
    } catch {
      // Ignore warmup failures. Normal navigation still works.
    }
  }

  function preloadImage(src) {
    if (!src || prefetched.has(`img:${src}`)) return;
    prefetched.add(`img:${src}`);
    const image = new Image();
    image.decoding = 'async';
    image.loading = 'eager';
    image.src = src;
  }

  function warmUrl(url) {
    if (!url) return;
    if (isSameOriginLocalUrl(url)) {
      prefetchLink(url.href, isHtmlLikeUrl(url) ? 'document' : undefined);
      warmFetch(url.href);
    }
  }

  function warmStaticAssets() {
    LOCAL_ASSETS.forEach((asset) => {
      if (/\.(png|jpe?g|webp|svg)$/i.test(asset)) preloadImage(asset);
      else prefetchLink(asset, asset.endsWith('.html') ? 'document' : undefined);
      if (!/ola-map-v4\.js/.test(asset)) warmFetch(asset);
    });
  }

  function warmMapShellIfUseful() {
    const route = (window.location.pathname.split('/').pop() || 'menu.html').toLowerCase();
    if (route !== 'menu.html' && route !== 'cart.html' && route !== 'profile.html') return;
    addPreconnect('https://unpkg.com');
    addPreconnect('https://api.olamaps.io');
    prefetchLink('ola-map-v4.js?v=20260523_appfeel1', 'script');
    prefetchLink('https://unpkg.com/maplibre-gl@5.9.0/dist/maplibre-gl.css', 'style');
  }

  function cartHasItems() {
    try {
      const raw = localStorage.getItem('cart');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      return items.some((item) => Number(item?.qty ?? item?.quantity ?? item?.count ?? 0) > 0);
    } catch {
      return false;
    }
  }

  function warmRazorpayIfUseful() {
    const route = (window.location.pathname.split('/').pop() || '').toLowerCase();
    if (route !== 'cart.html' || !cartHasItems()) return;
    addPreconnect('https://checkout.razorpay.com');
    prefetchLink('https://checkout.razorpay.com/v1/checkout.js', 'script');
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
    const url = safeUrl(anchor.href);
    if (!isSameOriginLocalUrl(url) || !isHtmlLikeUrl(url)) return;
    warmUrl(url);
  }

  function handleNavigationClick(event) {
    const anchor = event.target.closest?.('a[href]');
    if (shouldSkipTransitionForAnchor(anchor, event)) return;

    const url = safeUrl(anchor.href);
    if (!url) return;

    if (isCurrentPage(url)) {
      event.preventDefault();
      if (window.CoimbatoreFoodsBottomNav?.refresh) window.CoimbatoreFoodsBottomNav.refresh();
      return;
    }

    event.preventDefault();
    if (isNavigating) return;
    isNavigating = true;

    anchor.classList.add('is-pressing');
    warmUrl(url);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reducedMotion) document.body.classList.add('cbe-page-leaving');

    window.setTimeout(() => {
      window.location.assign(url.href);
    }, reducedMotion ? 0 : 85);
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`sw.js?v=${SPEED_VERSION}`).catch(() => null);
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
    injectAppFeelCss();
    document.body?.classList.remove('cbe-page-leaving');
    document.body?.classList.add('pwa-speed-ready');

    document.addEventListener('click', handleNavigationClick, true);
    document.addEventListener('touchstart', handlePotentialWarmup, { passive: true, capture: true });
    document.addEventListener('pointerenter', handlePotentialWarmup, { passive: true, capture: true });
    document.addEventListener('focusin', handlePotentialWarmup, true);

    runWhenIdle(() => {
      warmStaticAssets();
      warmMapShellIfUseful();
      warmRazorpayIfUseful();
    }, 900);
  }

  registerServiceWorker();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener('pageshow', () => {
    isNavigating = false;
    document.body?.classList.remove('cbe-page-leaving');
    document.querySelectorAll('.is-pressing').forEach((el) => el.classList.remove('is-pressing'));
    window.CoimbatoreFoodsBottomNav?.refresh?.();
  });

  window.CBEPWASpeed = {
    version: SPEED_VERSION,
    warmStaticAssets,
    warmMapShellIfUseful,
    warmRazorpayIfUseful,
    warmUrl: (href) => warmUrl(safeUrl(href))
  };
})();
