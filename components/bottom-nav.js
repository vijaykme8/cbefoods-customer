(() => {
  const STYLE_ID = 'cfBottomNavCss';
  const CSS_HREF = 'components/bottom-nav.css?v=20260520_commonnav5';
  const ICON_BASE = './assets/bottom-nav-bar/';
  const FALLBACK_ICON_BASE = './assets/menu/icons/';
  const ICON_VERSION = '20260520_bottomnav_states1';

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
      match: ['menu', 'index', 'home', ''],
      modifier: 'menu',
      activeIcons: [
        'menu-active.svg',
        'menu-active-icon.svg',
        'menu-icon-active.svg',
        'menu active.svg',
        'menu-icon active.svg',
        'active-menu.svg',
        'active/menu.svg',
        'menu/active.svg',
        'search-active.svg',
        'search-active-icon.svg',
        'search-icon-active.svg',
        'search active.svg'
      ],
      inactiveIcons: [
        'menu-inactive.svg',
        'menu-inactive-icon.svg',
        'menu-icon-inactive.svg',
        'menu inactive.svg',
        'menu-icon inactive.svg',
        'inactive-menu.svg',
        'inactive/menu.svg',
        'menu/inactive.svg',
        'search-inactive.svg',
        'search-inactive-icon.svg',
        'search-icon-inactive.svg',
        'search inactive.svg'
      ],
      fallbackIcon: `${FALLBACK_ICON_BASE}search-icon.svg`
    },
    {
      key: 'cart',
      label: 'Cart',
      href: 'cart.html',
      match: ['cart'],
      modifier: 'cart',
      activeIcons: [
        'cart-active.svg',
        'cart-active-icon.svg',
        'cart-icon-active.svg',
        'cart active.svg',
        'cart-icon active.svg',
        'active-cart.svg',
        'active/cart.svg',
        'cart/active.svg'
      ],
      inactiveIcons: [
        'cart-inactive.svg',
        'cart-inactive-icon.svg',
        'cart-icon-inactive.svg',
        'cart inactive.svg',
        'cart-icon inactive.svg',
        'inactive-cart.svg',
        'inactive/cart.svg',
        'cart/inactive.svg'
      ],
      fallbackIcon: `${FALLBACK_ICON_BASE}cart-icon.svg`
    },
    {
      key: 'track',
      label: 'Track orders',
      href: 'track.html',
      match: ['track', 'track-order', 'orders'],
      modifier: 'track',
      activeIcons: [
        'track-active.svg',
        'track-active-icon.svg',
        'track-icon-active.svg',
        'track active.svg',
        'track-icon active.svg',
        'track-orders-active.svg',
        'track-orders-active-icon.svg',
        'track-orders-icon-active.svg',
        'track orders active.svg',
        'active-track.svg',
        'active-track-orders.svg',
        'active/track.svg',
        'track/active.svg'
      ],
      inactiveIcons: [
        'track-inactive.svg',
        'track-inactive-icon.svg',
        'track-icon-inactive.svg',
        'track inactive.svg',
        'track-icon inactive.svg',
        'track-orders-inactive.svg',
        'track-orders-inactive-icon.svg',
        'track-orders-icon-inactive.svg',
        'track orders inactive.svg',
        'inactive-track.svg',
        'inactive-track-orders.svg',
        'inactive/track.svg',
        'track/inactive.svg'
      ],
      fallbackIcon: `${FALLBACK_ICON_BASE}track-icon.svg`
    }
  ];

  function currentRouteName() {
    const raw = window.location.pathname.split('/').pop() || '';
    return raw.replace(/\.html$/i, '').toLowerCase();
  }

  function shouldHideBottomNav() {
    const route = currentRouteName();
    const params = new URLSearchParams(window.location.search);

    return (
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
    const matched = navItems.find((item) => item.match.includes(route));
    return matched ? matched.key : 'menu';
  }

  function ensureCss() {
    if (document.getElementById(STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    document.head.appendChild(link);
  }

  function attr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function withVersion(url) {
    if (!url) return '';
    return `${url}${url.includes('?') ? '&' : '?'}v=${ICON_VERSION}`;
  }

  function iconCandidates(item, isActive) {
    const names = isActive ? item.activeIcons : item.inactiveIcons;
    const candidates = names.map((name) => `${ICON_BASE}${name}`);
    candidates.push(item.fallbackIcon);
    return candidates.map(withVersion);
  }

  function iconImg(item, isActive) {
    const candidates = iconCandidates(item, isActive);
    return `
      <img
        class="cf-bottom-nav__state-icon"
        src="${attr(candidates[0])}"
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        data-icon-index="0"
        data-icon-candidates="${attr(candidates.join('|'))}"
      />
    `;
  }

  function attachIconFallbacks(mount) {
    const icons = mount.querySelectorAll('.cf-bottom-nav__state-icon');
    icons.forEach((img) => {
      img.addEventListener('error', () => {
        const candidates = (img.dataset.iconCandidates || '').split('|').filter(Boolean);
        const currentIndex = Number(img.dataset.iconIndex || '0');
        const nextIndex = currentIndex + 1;
        if (nextIndex < candidates.length) {
          img.dataset.iconIndex = String(nextIndex);
          img.src = candidates[nextIndex];
        }
      });
    });
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

    mount.innerHTML = `
      <nav class="BottomNavBar cf-bottom-nav" data-layer="bottom nav bar" aria-label="Bottom navigation">
        ${navItems.map((item, index) => {
          const isActive = item.key === active;
          const navClass = index === 0 ? 'Nav1' : index === 1 ? 'Nav2' : 'Nav3';
          const labelClass = item.key === 'track' ? 'TrackOrders' : item.key === 'cart' ? 'Cart' : 'Menu';

          return `
            <a
              class="${navClass} cf-bottom-nav__item cf-bottom-nav__item--${item.modifier} ${isActive ? 'is-active' : 'is-inactive'}"
              data-layer="nav ${index + 1}"
              href="${item.href}"
              ${isActive ? 'aria-current="page"' : ''}
              aria-label="${item.label}"
              data-nav-key="${item.key}"
              data-nav-active="${isActive ? 'true' : 'false'}"
            >
              <span class="Icon cf-bottom-nav__icon" data-layer="icon">
                ${iconImg(item, isActive)}
              </span>
              <span class="${labelClass} cf-bottom-nav__label" data-layer="${item.label}">${item.label}</span>
            </a>
          `;
        }).join('')}
      </nav>
    `;

    attachIconFallbacks(mount);
    document.body.classList.add('has-bottom-nav');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderBottomNav, { once: true });
  } else {
    renderBottomNav();
  }

  window.addEventListener('pageshow', renderBottomNav);

  window.CoimbatoreFoodsBottomNav = {
    refresh: renderBottomNav,
    hide() {
      document.body.dataset.bottomNav = 'off';
      renderBottomNav();
    },
    show() {
      delete document.body.dataset.bottomNav;
      renderBottomNav();
    },
    debug() {
      return {
        route: currentRouteName(),
        active: activeKey(),
        iconBase: ICON_BASE,
        activeIcons: navItems.reduce((acc, item) => {
          acc[item.key] = iconCandidates(item, true);
          return acc;
        }, {}),
        inactiveIcons: navItems.reduce((acc, item) => {
          acc[item.key] = iconCandidates(item, false);
          return acc;
        }, {})
      };
    }
  };
})();
