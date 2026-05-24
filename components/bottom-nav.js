/* Bottom nav removed for UI refinement. Kept as a safe no-op for old cached pages. */
(() => {
  function removeBottomNav() {
    document.body?.classList?.remove('has-bottom-nav');
    document.querySelectorAll('#bottomNavMount, .BottomNavBar, .cf-bottom-nav').forEach((node) => node.remove());
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeBottomNav, { once: true });
  } else {
    removeBottomNav();
  }
  window.addEventListener('pageshow', removeBottomNav);
  window.CoimbatoreFoodsBottomNav = {
    refresh: removeBottomNav,
    updateBadge() {},
    hide: removeBottomNav,
    show: removeBottomNav,
    debug() { return { removed: true }; }
  };
})();
