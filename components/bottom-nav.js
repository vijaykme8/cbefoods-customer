(() => {
  const STYLE_ID = 'cfBottomNavCss';
  const CSS_HREF = 'components/bottom-nav.css?v=20260520_commonnav4';

  const ACTIVE_COLOR = '#941FD3';
  const INACTIVE_COLOR = '#B8B8B7';
  const ICON_BASE = './assets/menu/icons/';
  const ICON_VERSION = '20260520_navicons4';

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
      icon: 'search-icon.svg'
    },
    {
      key: 'cart',
      label: 'Cart',
      href: 'cart.html',
      match: ['cart'],
      modifier: 'cart',
      icon: 'cart-icon.svg'
    },
    {
      key: 'track',
      label: 'Track orders',
      href: 'track.html',
      match: ['track', 'track-order', 'orders'],
      modifier: 'track',
      icon: 'track-icon.svg'
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

  function iconMask(iconName, color, label) {
    const url = `${ICON_BASE}${iconName}?v=${ICON_VERSION}`;
    return `
      <span
        class="cf-bottom-nav__mask-icon"
        aria-hidden="true"
        style="--cf-nav-icon-url: url('${url}'); --cf-nav-icon-color: ${color};"
      ></span>
      <img
        class="cf-bottom-nav__fallback-icon"
        src="${url}"
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
      />
    `;
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
          const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
          const navClass = index === 0 ? 'Nav1' : index === 1 ? 'Nav2' : 'Nav3';
          const labelClass = item.key === 'track' ? 'TrackOrders' : item.key === 'cart' ? 'Cart' : 'Menu';

          return `
            <a
              class="${navClass} cf-bottom-nav__item cf-bottom-nav__item--${item.modifier} ${isActive ? 'is-active' : ''}"
              data-layer="nav ${index + 1}"
              href="${item.href}"
              ${isActive ? 'aria-current="page"' : ''}
              aria-label="${item.label}"
              data-nav-key="${item.key}"
              data-nav-active="${isActive ? 'true' : 'false'}"
            >
              <span class="Icon cf-bottom-nav__icon" data-layer="icon">
                ${iconMask(item.icon, color, item.label)}
              </span>
              <span class="${labelClass} cf-bottom-nav__label" data-layer="${item.label}">${item.label}</span>
            </a>
          `;
        }).join('')}
      </nav>
    `;

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
        activeColor: ACTIVE_COLOR,
        inactiveColor: INACTIVE_COLOR,
        iconBase: ICON_BASE
      };
    }
  };
})();
