(() => {
  const STYLE_ID = 'cfBottomNavCss';
  const CSS_HREF = 'components/bottom-nav.css?v=20260511_nav2';

  const ACTIVE_COLOR = '#8806CE';
  const INACTIVE_COLOR = '#B8B8B7';

  const hiddenPages = new Set([
    'login',
    'otp',
    'payment',
    'payment-waiting',
    'order-placed',
    'success',
    'login.html',
    'otp.html',
    'payment.html',
    'payment-waiting.html',
    'order-placed.html',
    'success.html'
  ]);

  function svgFill(color) {
    return `fill="${color}"`;
  }

  function searchIcon(color) {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#fff">
        <path d="M11.5 21.75C5.85 21.75 1.25 17.15 1.25 11.5C1.25 5.85 5.85 1.25 11.5 1.25C17.15 1.25 21.75 5.85 21.75 11.5C21.75 17.15 17.15 21.75 11.5 21.75ZM11.5 2.75C6.67 2.75 2.75 6.68 2.75 11.5C2.75 16.32 6.67 20.25 11.5 20.25C16.33 20.25 20.25 16.32 20.25 11.5C20.25 6.68 16.33 2.75 11.5 2.75Z" ${svgFill(color)}/>
        <path d="M21.9999 22.7499C21.8099 22.7499 21.6199 22.6799 21.4699 22.5299L19.4699 20.5299C19.1799 20.2399 19.1799 19.7599 19.4699 19.4699C19.7599 19.1799 20.2399 19.1799 20.5299 19.4699L22.5299 21.4699C22.8199 21.7599 22.8199 22.2399 22.5299 22.5299C22.3799 22.6799 22.1899 22.7499 21.9999 22.7499Z" ${svgFill(color)}/>
      </svg>
    `;
  }

  function cartIcon(color) {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#fff">
        <g clip-path="url(#cf_bottom_nav_cart_clip)">
          <path d="M18.19 17.75H7.53999C6.54999 17.75 5.59999 17.33 4.92999 16.6C4.25999 15.87 3.92 14.89 4 13.9L4.83 3.94C4.86 3.63 4.74999 3.33001 4.53999 3.10001C4.32999 2.87001 4.04 2.75 3.73 2.75H2C1.59 2.75 1.25 2.41 1.25 2C1.25 1.59 1.59 1.25 2 1.25H3.74001C4.47001 1.25 5.15999 1.56 5.64999 2.09C5.91999 2.39 6.12 2.74 6.23 3.13H18.72C19.73 3.13 20.66 3.53 21.34 4.25C22.01 4.98 22.35 5.93 22.27 6.94L21.73 14.44C21.62 16.27 20.02 17.75 18.19 17.75ZM6.28 4.62L5.5 14.02C5.45 14.6 5.64 15.15 6.03 15.58C6.42 16.01 6.95999 16.24 7.53999 16.24H18.19C19.23 16.24 20.17 15.36 20.25 14.32L20.79 6.82001C20.83 6.23001 20.64 5.67001 20.25 5.26001C19.86 4.84001 19.32 4.60999 18.73 4.60999H6.28V4.62Z" ${svgFill(color)}/>
          <path d="M16.25 22.75C15.15 22.75 14.25 21.85 14.25 20.75C14.25 19.65 15.15 18.75 16.25 18.75C17.35 18.75 18.25 19.65 18.25 20.75C18.25 21.85 17.35 22.75 16.25 22.75ZM16.25 20.25C15.97 20.25 15.75 20.47 15.75 20.75C15.75 21.03 15.97 21.25 16.25 21.25C16.53 21.25 16.75 21.03 16.75 20.75C16.75 20.47 16.53 20.25 16.25 20.25Z" ${svgFill(color)}/>
          <path d="M8.25 22.75C7.15 22.75 6.25 21.85 6.25 20.75C6.25 19.65 7.15 18.75 8.25 18.75C9.35 18.75 10.25 19.65 10.25 20.75C10.25 21.85 9.35 22.75 8.25 22.75ZM8.25 20.25C7.97 20.25 7.75 20.47 7.75 20.75C7.75 21.03 7.97 21.25 8.25 21.25C8.53 21.25 8.75 21.03 8.75 20.75C8.75 20.47 8.53 20.25 8.25 20.25Z" ${svgFill(color)}/>
          <path d="M21 8.75H9C8.59 8.75 8.25 8.41 8.25 8C8.25 7.59 8.59 7.25 9 7.25H21C21.41 7.25 21.75 7.59 21.75 8C21.75 8.41 21.41 8.75 21 8.75Z" ${svgFill(color)}/>
        </g>
        <defs><clipPath id="cf_bottom_nav_cart_clip"><rect width="24" height="24" fill="white"/></clipPath></defs>
      </svg>
    `;
  }

  function trackIcon(color) {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#fff">
        <g clip-path="url(#cf_bottom_nav_track_clip)">
          <path d="M13 14.75H2C1.59 14.75 1.25 14.41 1.25 14V6C1.25 3.38 3.38 1.25 6 1.25H15C15.41 1.25 15.75 1.59 15.75 2V12C15.75 13.52 14.52 14.75 13 14.75ZM2.75 13.25H13C13.69 13.25 14.25 12.69 14.25 12V2.75H6C4.21 2.75 2.75 4.21 2.75 6V13.25Z" ${svgFill(color)}/>
          <path d="M19 20.75H18C17.59 20.75 17.25 20.41 17.25 20C17.25 19.31 16.69 18.75 16 18.75C15.31 18.75 14.75 19.31 14.75 20C14.75 20.41 14.41 20.75 14 20.75H10C9.59 20.75 9.25 20.41 9.25 20C9.25 19.31 8.69 18.75 8 18.75C7.31 18.75 6.75 19.31 6.75 20C6.75 20.41 6.41 20.75 6 20.75H5C2.93 20.75 1.25 19.07 1.25 17V14C1.25 13.59 1.59 13.25 2 13.25H13C13.69 13.25 14.25 12.69 14.25 12V5C14.25 4.59 14.59 4.25 15 4.25H16.84C17.83 4.25 18.74 4.78001 19.23 5.64001L20.94 8.63C21.07 8.86 21.07 9.15 20.94 9.38C20.81 9.61 20.56 9.75 20.29 9.75H19C18.86 9.75 18.75 9.86 18.75 10V13C18.75 13.14 18.86 13.25 19 13.25H22C22.41 13.25 22.75 13.59 22.75 14V17C22.75 19.07 21.07 20.75 19 20.75ZM18.65 19.25H19C20.24 19.25 21.25 18.24 21.25 17V14.75H19C18.04 14.75 17.25 13.96 17.25 13V10C17.25 9.04 18.03 8.25 19 8.25L17.93 6.38C17.71 5.99 17.29 5.75 16.84 5.75H15.75V12C15.75 13.52 14.52 14.75 13 14.75H2.75V17C2.75 18.24 3.76 19.25 5 19.25H5.35001C5.68001 18.1 6.74 17.25 8 17.25C9.26 17.25 10.32 18.1 10.65 19.25H13.36C13.69 18.1 14.75 17.25 16.01 17.25C17.27 17.25 18.32 18.1 18.65 19.25Z" ${svgFill(color)}/>
          <path d="M8 22.75C6.48 22.75 5.25 21.52 5.25 20C5.25 18.48 6.48 17.25 8 17.25C9.52 17.25 10.75 18.48 10.75 20C10.75 21.52 9.52 22.75 8 22.75ZM8 18.75C7.31 18.75 6.75 19.31 6.75 20C6.75 20.69 7.31 21.25 8 21.25C8.69 21.25 9.25 20.69 9.25 20C9.25 19.31 8.69 18.75 8 18.75Z" ${svgFill(color)}/>
          <path d="M16 22.75C14.48 22.75 13.25 21.52 13.25 20C13.25 18.48 14.48 17.25 16 17.25C17.52 17.25 18.75 18.48 18.75 20C18.75 21.52 17.52 22.75 16 22.75ZM16 18.75C15.31 18.75 14.75 19.31 14.75 20C14.75 20.69 15.31 21.25 16 21.25C16.69 21.25 17.25 20.69 17.25 20C17.25 19.31 16.69 18.75 16 18.75Z" ${svgFill(color)}/>
          <path d="M22 14.75H19C18.04 14.75 17.25 13.96 17.25 13V10C17.25 9.04 18.04 8.25 19 8.25H20.29C20.56 8.25 20.81 8.39 20.94 8.63L22.65 11.63C22.71 11.74 22.75 11.87 22.75 12V14C22.75 14.41 22.41 14.75 22 14.75ZM19 9.75C18.86 9.75 18.75 9.86 18.75 10V13C18.75 13.14 18.86 13.25 19 13.25H21.25V12.2L19.85 9.75H19Z" ${svgFill(color)}/>
        </g>
        <defs><clipPath id="cf_bottom_nav_track_clip"><rect width="24" height="24" fill="white"/></clipPath></defs>
      </svg>
    `;
  }

  const navItems = [
    { key: 'search', label: 'Search', href: 'menu.html', match: ['menu', 'index', 'home', ''], modifier: 'search', icon: searchIcon },
    { key: 'cart', label: 'Cart', href: 'cart.html', match: ['cart'], modifier: 'cart', icon: cartIcon },
    { key: 'track', label: 'Track orders', href: 'track.html', match: ['track', 'track-order', 'orders'], modifier: 'track', icon: trackIcon }
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
      document.body.dataset.bottomNav === 'off'
    );
  }

  function activeKey() {
    const route = currentRouteName();
    const matched = navItems.find((item) => item.match.includes(route));
    return matched ? matched.key : 'search';
  }

  function ensureCss() {
    if (document.getElementById(STYLE_ID)) return;

    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    document.head.appendChild(link);
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
      <nav class="cf-bottom-nav" aria-label="Bottom navigation">
        ${navItems.map((item) => {
          const isActive = item.key === active;
          const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;

          return `
            <a
              class="cf-bottom-nav__item cf-bottom-nav__item--${item.modifier} ${isActive ? 'is-active' : ''}"
              href="${item.href}"
              ${isActive ? 'aria-current="page"' : ''}
              aria-label="${item.label}"
              data-nav-key="${item.key}"
              data-nav-active="${isActive ? 'true' : 'false'}"
              data-nav-route="${currentRouteName()}"
            >
              <span class="cf-bottom-nav__icon">${item.icon(color)}</span>
              <span class="cf-bottom-nav__label">${item.label}</span>
            </a>
          `;
        }).join('')}
      </nav>
    `;

    document.body.classList.add('has-bottom-nav');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderBottomNav);
  } else {
    renderBottomNav();
  }

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
        inactiveColor: INACTIVE_COLOR
      };
    }
  };
})();
