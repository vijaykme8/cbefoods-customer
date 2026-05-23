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

  function authOk() {
    try {
      return Boolean(
        localStorage.getItem('cust_auth') ||
        localStorage.getItem('customerAuth') ||
        localStorage.getItem('TIFFIN_CUSTOMER_AUTH') ||
        localStorage.getItem('TIFFIN_AUTH') ||
        localStorage.getItem('authUser')
      );
    } catch (error) {
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
    return `${absolute.pathname.split('/').pop()}${absolute.search}${absolute.hash}`;
  }

  function setLoading(isLoading) {
    document.body.classList.toggle('cf-shell-loading', Boolean(isLoading));
  }

  function clearModeFlags() {
    document.body.classList.remove('cf-shell-location-mode', 'cf-shell-fullscreen-child', 'cf-shell-no-nav-route');
  }

  function syncBottomNav() {
    if (window.CoimbatoreFoodsBottomNav) {
      window.CoimbatoreFoodsBottomNav.refresh();
      window.CoimbatoreFoodsBottomNav.updateBadge();
    }
  }

  function loadRoute(route, options = {}) {
    const safeRoute = ROUTES[route] ? route : DEFAULT_ROUTE;
    const baseUrl = ROUTES[safeRoute];
    currentRoute = safeRoute;
    if (location.hash !== `#${safeRoute}` && !options.skipHash) {
      history.replaceState(null, '', `#${safeRoute}`);
    }
    clearModeFlags();
    document.body.classList.toggle('cf-shell-no-nav-route', safeRoute === 'profile');
    setLoading(true);
    frame.src = withEmbedded(baseUrl);
    syncBottomNav();
  }

  function pathNameOfFrame() {
    try {
      const href = frame.contentWindow.location.href;
      return new URL(href).pathname.split('/').pop() || '';
    } catch (error) {
      return '';
    }
  }

  function frameSearchParams() {
    try {
      return new URL(frame.contentWindow.location.href).searchParams;
    } catch (error) {
      return new URLSearchParams();
    }
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
      frame.src = `${page}${url.search}${url.hash}`;
      return true;
    } catch (error) {
      return false;
    }
  }

  function syncHashFromFrame() {
    const page = pathNameOfFrame();
    const route = page === 'cart.html' ? 'cart' : page === 'track.html' ? 'track' : page === 'profile.html' ? 'profile' : page === 'menu.html' ? 'menu' : '';
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
    } catch (error) {
      window.location.href = page;
      return true;
    }
  }

  function syncLocationMode() {
    let isLocation = false;
    let isFullscreenChild = false;
    try {
      const params = frameSearchParams();
      const doc = frame.contentDocument;
      const body = doc && doc.body;
      isLocation =
        params.get('openLocation') === '1' ||
        Boolean(body && (
          body.classList.contains('map-screen-open') ||
          body.classList.contains('is-location-flow-open') ||
          body.classList.contains('no-bottom-nav') ||
          body.dataset.bottomNav === 'off'
        ));
      const page = pathNameOfFrame();
      isFullscreenChild = page === 'track-fullscreen.html' || page === 'order_placed.html';
    } catch (error) {
      isLocation = false;
      isFullscreenChild = false;
    }

    document.body.classList.toggle('cf-shell-location-mode', isLocation);
    document.body.classList.toggle('cf-shell-fullscreen-child', isFullscreenChild);
    document.body.classList.toggle('cf-shell-no-nav-route', currentRoute === 'profile');
    syncBottomNav();
  }

  function installChildBridge() {
    try {
      const win = frame.contentWindow;
      const doc = win.document;
      if (!doc || doc.__cfShellBridgeInstalled) return;
      doc.__cfShellBridgeInstalled = true;

      win.openCbeProfile = () => {
        window.location.hash = '#profile';
      };

      const observer = new MutationObserver(() => syncLocationMode());
      if (doc.body) {
        observer.observe(doc.body, { attributes: true, attributeFilter: ['class', 'data-bottom-nav'] });
      }

      doc.addEventListener('click', (event) => {
        const anchor = event.target.closest?.('a[href]');
        if (!anchor) return;
        const href = anchor.getAttribute('href') || '';
        if (href === 'menu.html' || href === './menu.html') { event.preventDefault(); window.location.hash = '#menu'; }
        if (href === 'cart.html' || href === './cart.html') { event.preventDefault(); window.location.hash = '#cart'; }
        if (href === 'track.html' || href === './track.html') { event.preventDefault(); window.location.hash = '#track'; }
        if (href === 'profile.html' || href === './profile.html') { event.preventDefault(); window.location.hash = '#profile'; }
      }, true);
    } catch (error) {
      // Same-origin access can fail only in unusual browser modes. Ignore safely.
    }
  }

  frame.addEventListener('load', () => {
    if (handleExternalChildPage()) return;
    if (ensureEmbeddedForViewPage()) return;
    syncHashFromFrame();
    installChildBridge();
    syncLocationMode();
    setLoading(false);
  });

  window.addEventListener('hashchange', () => {
    const route = routeFromHash();
    if (route !== currentRoute) loadRoute(route, { skipHash: true });
  });

  window.addEventListener('cbe:shell-route', (event) => {
    const route = event.detail && event.detail.route;
    if (route && ROUTES[route]) loadRoute(route);
  });

  window.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'cbe:navigate' && ROUTES[data.route]) {
      window.location.hash = `#${data.route}`;
    }
    if (data.type === 'cbe:bottom-nav-refresh') syncBottomNav();
  });

  routeTimer = window.setInterval(syncLocationMode, 300);
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
