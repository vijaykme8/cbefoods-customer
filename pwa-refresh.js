(function () {
  var BUILD_VERSION = '20260531_ios_refresh_portrait1';

  function clearAppCaches() {
    if (!('caches' in window)) return Promise.resolve();
    return caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (/cbe|customer|tiffin|peparo/i.test(key)) return caches.delete(key);
        return Promise.resolve(false);
      }));
    });
  }

  try {
    var lastVersion = localStorage.getItem('cf_customer_build_version');
    if (lastVersion && lastVersion !== BUILD_VERSION) {
      clearAppCaches().finally(function () {
        localStorage.setItem('cf_customer_build_version', BUILD_VERSION);
        if (!sessionStorage.getItem('cf_customer_update_reload')) {
          sessionStorage.setItem('cf_customer_update_reload', '1');
          window.location.reload();
        }
      });
    } else {
      localStorage.setItem('cf_customer_build_version', BUILD_VERSION);
    }
  } catch (_) {}

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(function (registration) {
      registration.update().catch(function () {});
    }).catch(function () {});

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (sessionStorage.getItem('cf_customer_controller_reload')) return;
      sessionStorage.setItem('cf_customer_controller_reload', '1');
      window.location.reload();
    });
  }

  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('portrait').catch(function () {});
  }
})();
