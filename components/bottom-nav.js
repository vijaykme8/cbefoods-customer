(() => {
  const STYLE_ID = 'cfBottomNavCss';
  const CSS_HREF = 'components/bottom-nav.css';

  const hiddenPages = new Set([
    'login.html',
    'otp.html',
    'payment.html',
    'payment-waiting.html',
    'order-placed.html',
    'success.html'
  ]);

  const navItems = [
    {
      key: 'menu',
      label: 'Search',
      href: 'menu.html',
      match: ['menu.html', 'index.html', 'home.html'],
      icon: `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10.8 3a7.8 7.8 0 0 1 6.16 12.58l3.23 3.23a.98.98 0 0 1-1.38 1.38l-3.23-3.23A7.8 7.8 0 1 1 10.8 3Zm0 1.95a5.85 5.85 0 1 0 0 11.7 5.85 5.85 0 0 0 0-11.7Z" fill="currentColor"/>
        </svg>
      `
    },
    {
      key: 'cart',
      label: 'Cart',
      href: 'cart.html',
      match: ['cart.html'],
      icon: `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6.35 6.75h14.2c.7 0 1.22.65 1.07 1.33l-1.18 5.31a2.75 2.75 0 0 1-2.68 2.15H9.1a2.75 2.75 0 0 1-2.7-2.22L4.8 4.95H2.75a1 1 0 0 1 0-2h2.88c.48 0 .9.34.99.81l.73 2.99Zm2.2 2 1 4.18c.06.36.38.62.75.62h7.46c.36 0 .68-.25.76-.6l.93-4.2H8.55ZM9.4 21.05a1.55 1.55 0 1 1 0-3.1 1.55 1.55 0 0 1 0 3.1Zm8.25 0a1.55 1.55 0 1 1 0-3.1 1.55 1.55 0 0 1 0 3.1Z" fill="currentColor"/>
        </svg>
      `
    },
    {
      key: 'track',
      label: 'Track orders',
      href: 'track.html',
      match: ['track.html', 'track-order.html', 'orders.html'],
      icon: `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2.75a8.5 8.5 0 0 1 8.5 8.5c0 5.6-6.64 10.23-7.7 10.92a1.5 1.5 0 0 1-1.6 0c-1.06-.69-7.7-5.32-7.7-10.92A8.5 8.5 0 0 1 12 2.75Zm0 2a6.5 6.5 0 0 0-6.5 6.5c0 3.88 4.4 7.56 6.5 9.02 2.1-1.46 6.5-5.14 6.5-9.02A6.5 6.5 0 0 0 12 4.75Zm0 3.25a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5Zm0 2a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 10Z" fill="currentColor"/>
        </svg>
      `
    }
  ];

  function currentPage() {
    const file = window.location.pathname.split('/').pop();
    return file || 'index.html';
  }

  function shouldHideBottomNav() {
    const page = currentPage();
    const params = new URLSearchParams(window.location.search);

    return (
      hiddenPages.has(page) ||
      params.get('openLocation') === '1' ||
      document.body.classList.contains('no-bottom-nav') ||
      document.body.dataset.bottomNav === 'off'
    );
  }

  function activeKey() {
    const page = currentPage();
    const match = navItems.find((item) => item.match.includes(page));
    return match ? match.key : 'menu';
  }

  function ensureCss() {
    if (document.getElementById(STYLE_ID)) return;

    const alreadyLinked = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some((link) => (link.getAttribute('href') || '').includes('bottom-nav.css'));

    if (alreadyLinked) return;

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
          return `
            <a
              class="cf-bottom-nav__item ${isActive ? 'is-active' : ''}"
              href="${item.href}"
              ${isActive ? 'aria-current="page"' : ''}
              aria-label="${item.label}"
            >
              ${item.icon}
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
    }
  };
})();
