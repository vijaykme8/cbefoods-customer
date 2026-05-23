(() => {
  const STYLE_ID = 'cfBottomNavCss';
  const CSS_HREF = 'components/bottom-nav.css?v=20260523_appshell1';
  const ICON_BASE = './assets/bottom-nav-bar/';
  const ICON_VERSION = '20260523_appshell1';

  const hiddenPages = new Set([
    'login',
    'otp',
    'payment',
    'payment-waiting',
    'order-placed',
    'order_placed',
    'success',
    'track-fullscreen',
    'login.html',
    'otp.html',
    'payment.html',
    'payment-waiting.html',
    'order-placed.html',
    'order_placed.html',
    'success.html',
    'track-fullscreen.html'
  ]);

  const navItems = [
    {
      key: 'menu',
      label: 'Menu',
      href: 'menu.html',
      shellHref: 'app.html#menu',
      match: ['menu', 'index', 'home', 'app', ''],
      modifier: 'menu',
      activeIcon: 'active-search-icon.svg',
      inactiveIcon: 'inactive-search-icon.svg'
    },
    {
      key: 'cart',
      label: 'Cart',
      href: 'cart.html',
      shellHref: 'app.html#cart',
      match: ['cart'],
      modifier: 'cart',
      activeIcon: 'active-cart-icon.svg',
      inactiveIcon: 'inactive-cart-icon.svg'
    },
    {
      key: 'track',
      label: 'Track orders',
      href: 'track.html',
      shellHref: 'app.html#track',
      match: ['track', 'track-order', 'orders'],
      modifier: 'track',
      activeIcon: 'active-track-icon.svg',
      inactiveIcon: 'inactive-track-icon.svg'
    }
  ];

  function isEmbeddedPage() {
    const params = new URLSearchParams(window.location.search || '');
    return params.get('embedded') === '1' || window.self !== window.top;
  }

  function isShellPage() {
    const raw = (window.location.pathname.split('/').pop() || '').toLowerCase();
    return raw === 'app.html' || raw === 'app';
  }

  function shellRouteFromHash() {
    if (!isShellPage()) return '';
    const value = (window.location.hash || '#menu').replace(/^#/, '').split('?')[0].toLowerCase();
    if (value === 'cart') return 'cart';
    if (value === 'track') return 'track';
    if (value === 'profile') return 'profile';
    return 'menu';
  }

  function currentRouteName() {
    if (isShellPage()) return shellRouteFromHash();
    const raw = window.location.pathname.split('/').pop() || '';
    return raw.replace(/\.html$/i, '').toLowerCase();
  }

  function shouldHideBottomNav() {
    const route = currentRouteName();
    const params = new URLSearchParams(window.location.search || '');

    return (
      isEmbeddedPage() ||
      route === 'profile' ||
      hiddenPages.has(route) ||
      params.get('openLocation') === '1' ||
      document.body.classList.contains('no-bottom-nav') ||
      document.body.classList.contains('map-screen-open') ||
      document.body.classList.contains('is-location-flow-open') ||
      document.body.dataset.bottomNav === 'off'
    );
  }

  function activeKey() {
    const route = currentRouteName();
    if (route === 'cart') return 'cart';
    if (route === 'track') return 'track';
    return 'menu';
  }

  function ensureCss() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    document.head.appendChild(link);
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function iconMarkup(item, isActive) {
    const file = isActive ? item.activeIcon : item.inactiveIcon;
    const src = `${ICON_BASE}${file}?v=${ICON_VERSION}`;
    return `<img class="cf-bottom-nav__state-icon" src="${escapeAttr(src)}" alt="" aria-hidden="true" loading="eager" decoding="async">`;
  }

  function readCartQtyFromStorage() {
    let raw = null;
    try { raw = localStorage.getItem('cart'); } catch (error) { raw = null; }
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? Object.values(parsed)
          : [];
      return items.reduce((sum, item) => {
        if (!item || typeof item !== 'object') return sum;
        return sum + (Number(item.qty || item.quantity || 0) || 0);
      }, 0);
    } catch (error) {
      return 0;
    }
  }

  function updateBadge(totalQty) {
    const qty = Math.max(0, Number(totalQty ?? readCartQtyFromStorage()) || 0);
    const cartNav = document.querySelector('.cf-bottom-nav__item--cart') || document.querySelector('[data-nav-key="cart"]');
    if (!cartNav) return;
    let badge = cartNav.querySelector('.cart-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cart-badge cf-bottom-nav__badge';
      badge.setAttribute('aria-hidden', 'true');
      cartNav.appendChild(badge);
    }
    if (qty <= 0) {
      badge.style.display = 'none';
      badge.textContent = '';
      cartNav.removeAttribute('data-cart-count');
    } else {
      badge.style.display = 'flex';
      badge.textContent = qty > 99 ? '99+' : String(qty);
      cartNav.setAttribute('data-cart-count', String(qty));
    }
  }

  function navHref(item) {
    return isEmbeddedPage() ? item.href : item.shellHref;
  }

  function renderBottomNav() {
    ensureCss();
    let mount = document.getElementById('bottomNavMount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'bottomNavMount';
      document.body.appendChild(mount);
    }

    if (shouldHideBottomNav()) {
      mount.innerHTML = '';
      document.body.classList.remove('has-bottom-nav');
      return;
    }

    const active = activeKey();
    const currentCartQty = readCartQtyFromStorage();
    mount.innerHTML = `
      <nav class="BottomNavBar cf-bottom-nav" data-layer="bottom nav bar" aria-label="Bottom navigation">
        ${navItems.map((item, index) => {
          const isActive = item.key === active;
          const navClass = index === 0 ? 'Nav1' : index === 1 ? 'Nav2' : 'Nav3';
          const labelClass = item.key === 'track' ? 'TrackOrders' : item.key === 'cart' ? 'Cart' : 'Menu';
          const modifierClass = `cf-bottom-nav__item--${item.modifier}`;
          const badgeMarkup = item.key === 'cart'
            ? `<span class="cart-badge cf-bottom-nav__badge" aria-hidden="true" style="display:${currentCartQty > 0 ? 'flex' : 'none'}">${currentCartQty > 99 ? '99+' : currentCartQty || ''}</span>`
            : '';
          return `
            <a
              class="${navClass} cf-bottom-nav__item ${modifierClass} ${isActive ? 'is-active' : 'is-inactive'}"
              data-layer="nav ${index + 1}"
              href="${navHref(item)}"
              ${isActive ? 'aria-current="page"' : ''}
              aria-label="${escapeAttr(item.label)}"
              data-nav-key="${item.key}"
              data-nav-active="${isActive ? 'true' : 'false'}"
              ${item.key === 'cart' && currentCartQty > 0 ? `data-cart-count="${currentCartQty}"` : ''}
            >
              <span class="Icon cf-bottom-nav__icon" data-layer="icon">${iconMarkup(item, isActive)}</span>
              ${badgeMarkup}
              <span class="${labelClass} cf-bottom-nav__label" data-layer="${escapeAttr(item.label)}">${item.label}</span>
            </a>`;
        }).join('')}
      </nav>`;
    document.body.classList.add('has-bottom-nav');
    updateBadge(currentCartQty);
  }

  function refreshSoon() {
    window.requestAnimationFrame(() => updateBadge());
  }

  function installShellClickHandler() {
    if (!isShellPage()) return;
    document.addEventListener('click', (event) => {
      const link = event.target.closest?.('.cf-bottom-nav__item');
      if (!link) return;
      const key = link.getAttribute('data-nav-key');
      if (!key) return;
      event.preventDefault();
      const nextHash = key === 'cart' ? '#cart' : key === 'track' ? '#track' : '#menu';
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      } else {
        window.dispatchEvent(new CustomEvent('cbe:shell-route', { detail: { route: key } }));
      }
      renderBottomNav();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { renderBottomNav(); installShellClickHandler(); }, { once: true });
  } else {
    renderBottomNav();
    installShellClickHandler();
  }

  window.addEventListener('hashchange', renderBottomNav);
  window.addEventListener('pageshow', () => { renderBottomNav(); refreshSoon(); });
  window.addEventListener('popstate', renderBottomNav);
  window.addEventListener('storage', (event) => { if (!event.key || event.key === 'cart') updateBadge(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateBadge(); });

  window.CoimbatoreFoodsBottomNav = {
    refresh: renderBottomNav,
    updateBadge,
    hide() { document.body.dataset.bottomNav = 'off'; renderBottomNav(); },
    show() { delete document.body.dataset.bottomNav; renderBottomNav(); },
    debug() { return { route: currentRouteName(), active: activeKey(), cartQty: readCartQtyFromStorage(), shell: isShellPage(), embedded: isEmbeddedPage() }; }
  };
})();
