(() => {
  const frame = document.getElementById('cfAppFrame');
  if (!frame) return;

  const ROUTES = {
    menu: 'menu.html',
    cart: 'cart.html',
    track: 'track.html',
    profile: 'profile.html'
  };

  const VIEW_PAGES = new Set(['menu.html', 'cart.html', 'track.html', 'profile.html']);
  const FULLSCREEN_PAGES = new Set(['track-fullscreen.html', 'order_placed.html', 'login.html']);
  const DEFAULT_ROUTE = 'menu';

  let currentRoute = '';
  let routeTimer = null;
  let shellMode = { location: false, fullscreen: false, noNav: false };

  function authOk() {
    try {
      return Boolean(
        localStorage.getItem('cust_auth') ||
        localStorage.getItem('customerAuth') ||
        localStorage.getItem('TIFFIN_CUSTOMER_AUTH') ||
        localStorage.getItem('TIFFIN_AUTH') ||
        localStorage.getItem('authUser')
      );
    } catch (_) {
      return false;
    }
  }

  function routeFromHash() {
    const raw = (location.hash || '').replace(/^#/, '').split('?')[0].toLowerCase();
    if (raw === 'cart' || raw === 'track' || raw === 'profile') return raw;
    return DEFAULT_ROUTE;
  }

  function withEmbedded(url) {
    const absolute = new URL(url, location.href);
    absolute.searchParams.set('embedded', '1');
    absolute.searchParams.set('shell', '1');
    absolute.searchParams.set('_shellv', '20260523_stable2');
    return `${absolute.pathname.split('/').pop()}${absolute.search}${absolute.hash}`;
  }

  function setLoading(isLoading) {
    // Keep route switching visually stable without showing a loading page overlay.
    document.body.classList.toggle('cf-shell-loading', Boolean(isLoading));
  }

  function requestChildLayout(reason = 'layout') {
    const payload = { type: 'cbe:shell-layout', reason, route: currentRoute };
    [0, 60, 160, 360].forEach((delay) => {
      window.setTimeout(() => {
        try { frame.contentWindow.postMessage(payload, '*'); } catch (_) {}
        try {
          const CustomEventCtor = frame.contentWindow.CustomEvent || CustomEvent;
          frame.contentWindow.dispatchEvent(new CustomEventCtor('cbe:shell-layout', { detail: payload }));
        } catch (_) {}
        try {
          if (typeof frame.contentWindow.__cbeShellResize === 'function') frame.contentWindow.__cbeShellResize(reason);
        } catch (_) {}
      }, delay);
    });
  }

  function applyShellMode(next = {}, reason = 'mode') {
    const merged = {
      location: Boolean(next.location),
      fullscreen: Boolean(next.fullscreen),
      noNav: Boolean(next.noNav)
    };

    const changed =
      merged.location !== shellMode.location ||
      merged.fullscreen !== shellMode.fullscreen ||
      merged.noNav !== shellMode.noNav;

    shellMode = merged;
    document.body.classList.toggle('cf-shell-location-mode', shellMode.location);
    document.body.classList.toggle('cf-shell-fullscreen-child', shellMode.fullscreen);
    document.body.classList.toggle('cf-shell-no-nav-route', shellMode.noNav);

    if (changed) {
      syncBottomNav();
      requestChildLayout(reason);
    }
  }

  function syncBottomNav() {
    if (window.CoimbatoreFoodsBottomNav) {
      window.CoimbatoreFoodsBottomNav.refresh();
      window.CoimbatoreFoodsBottomNav.updateBadge();
    }
  }

  function loadRoute(route, options = {}) {
    const safeRoute = ROUTES[route] ? route : DEFAULT_ROUTE;
    currentRoute = safeRoute;
    if (location.hash !== `#${safeRoute}` && !options.skipHash) {
      history.replaceState(null, '', `#${safeRoute}`);
    }
    applyShellMode({ location: false, fullscreen: false, noNav: safeRoute === 'profile' }, 'route-start');
    setLoading(true);
    frame.src = withEmbedded(ROUTES[safeRoute]);
    syncBottomNav();
  }

  function getFrameUrl() {
    try { return new URL(frame.contentWindow.location.href); } catch (_) { return null; }
  }

  function pathNameOfFrame() {
    const url = getFrameUrl();
    return url ? (url.pathname.split('/').pop() || '') : '';
  }

  function frameSearchParams() {
    const url = getFrameUrl();
    return url ? url.searchParams : new URLSearchParams();
  }

  function ensureEmbeddedForViewPage() {
    try {
      const win = frame.contentWindow;
      const url = new URL(win.location.href);
      const page = url.pathname.split('/').pop() || '';
      if (!VIEW_PAGES.has(page)) return false;
      if (url.searchParams.get('embedded') === '1') return false;
      url.searchParams.set('embedded', '1');
      url.searchParams.set('shell', '1');
      url.searchParams.set('_shellv', '20260523_stable2');
      frame.src = `${page}${url.search}${url.hash}`;
      return true;
    } catch (_) {
      return false;
    }
  }

  function routeForFramePage(page, url) {
    if (page === 'cart.html') return 'cart';
    if (page === 'track.html') return 'track';
    if (page === 'profile.html') return 'profile';
    if (page === 'menu.html') {
      const params = url ? url.searchParams : new URLSearchParams();
      const returnTo = (params.get('returnTo') || params.get('source') || '').toLowerCase();
      const isLocation = params.get('openLocation') === '1' || params.get('forceLocation') === '1' || returnTo;
      if (isLocation) {
        if (returnTo.startsWith('cart')) return 'cart';
        if (returnTo === 'profile') return 'profile';
        if (returnTo === 'track') return 'track';
        return currentRoute || DEFAULT_ROUTE;
      }
      return 'menu';
    }
    return '';
  }

  function syncHashFromFrame() {
    const url = getFrameUrl();
    const page = url ? (url.pathname.split('/').pop() || '') : '';
    const route = routeForFramePage(page, url);
    if (!route) return;
    currentRoute = route;
    if (location.hash !== `#${route}`) history.replaceState(null, '', `#${route}`);
    syncBottomNav();
  }

  function handleExternalChildPage() {
    const page = pathNameOfFrame();
    if (!FULLSCREEN_PAGES.has(page)) return false;
    try {
      const url = new URL(frame.contentWindow.location.href);
      window.location.href = `${page}${url.search}${url.hash}`;
      return true;
    } catch (_) {
      window.location.href = page;
      return true;
    }
  }

  function detectLocationMode() {
    let isLocation = false;
    let isFullscreenChild = false;
    try {
      const params = frameSearchParams();
      const doc = frame.contentDocument;
      const body = doc && doc.body;
      isLocation =
        params.get('openLocation') === '1' ||
        params.get('forceLocation') === '1' ||
        Boolean(body && (
          body.classList.contains('map-screen-open') ||
          body.classList.contains('is-location-flow-open') ||
          body.classList.contains('no-bottom-nav') ||
          body.dataset.bottomNav === 'off'
        ));
      const page = pathNameOfFrame();
      isFullscreenChild = page === 'track-fullscreen.html' || page === 'order_placed.html';
    } catch (_) {
      isLocation = false;
      isFullscreenChild = false;
    }
    return { location: isLocation, fullscreen: isFullscreenChild, noNav: currentRoute === 'profile' };
  }

  function syncLocationMode(reason = 'poll') {
    applyShellMode(detectLocationMode(), reason);
  }

  function shellNavigate(route) {
    if (!ROUTES[route]) return;
    if (route === currentRoute && pathNameOfFrame() === ROUTES[route]) return;
    window.location.hash = `#${route}`;
  }

  function installChildBridge() {
    try {
      const win = frame.contentWindow;
      const doc = win.document;
      if (!doc || doc.__cfShellBridgeInstalled) return;
      doc.__cfShellBridgeInstalled = true;

      win.openCbeProfile = () => shellNavigate('profile');
      win.CBEAppShell = {
        navigate: shellNavigate,
        setLocationMode(open) {
          applyShellMode({ location: Boolean(open), fullscreen: false, noNav: currentRoute === 'profile' }, 'child-api');
        },
        refresh() { syncLocationMode('child-refresh'); }
      };

      const observer = new MutationObserver(() => syncLocationMode('child-mutation'));
      if (doc.body) {
        observer.observe(doc.body, { attributes: true, attributeFilter: ['class', 'data-bottom-nav'] });
      }

      doc.addEventListener('click', (event) => {
        const anchor = event.target.closest?.('a[href]');
        if (!anchor) return;
        const href = anchor.getAttribute('href') || '';
        const clean = href.split('?')[0].split('#')[0].replace(/^\.\//, '');
        if (clean === 'menu.html') { event.preventDefault(); shellNavigate('menu'); }
        if (clean === 'cart.html') { event.preventDefault(); shellNavigate('cart'); }
        if (clean === 'track.html') { event.preventDefault(); shellNavigate('track'); }
        if (clean === 'profile.html') { event.preventDefault(); shellNavigate('profile'); }
      }, true);
    } catch (_) {
      // Same-origin access can fail only in unusual browser modes. Ignore safely.
    }
  }

  frame.addEventListener('load', () => {
    if (handleExternalChildPage()) return;
    if (ensureEmbeddedForViewPage()) return;
    syncHashFromFrame();
    installChildBridge();
    syncLocationMode('frame-load');
    setLoading(false);
    requestChildLayout('frame-load');
  });

  window.addEventListener('hashchange', () => {
    const route = routeFromHash();
    if (route !== currentRoute || pathNameOfFrame() !== ROUTES[route]) loadRoute(route, { skipHash: true });
  });

  window.addEventListener('cbe:shell-route', (event) => {
    const route = event.detail && event.detail.route;
    if (route && ROUTES[route]) shellNavigate(route);
  });

  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'cbe:navigate' && ROUTES[data.route]) {
      shellNavigate(data.route);
    }
    if (data.type === 'cbe:location-mode') {
      applyShellMode({ location: Boolean(data.open), fullscreen: false, noNav: currentRoute === 'profile' }, 'child-location-message');
    }
    if (data.type === 'cbe:bottom-nav-refresh') syncBottomNav();
  });

  routeTimer = window.setInterval(() => syncLocationMode('interval'), 500);
  window.addEventListener('pagehide', () => {
    if (routeTimer) window.clearInterval(routeTimer);
  });

  if (!authOk()) {
    window.location.replace('login.html');
    return;
  }

  if (!location.hash) history.replaceState(null, '', '#menu');
  loadRoute(routeFromHash(), { skipHash: true });
})();
