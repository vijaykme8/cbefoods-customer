(function () {
  const STORE_ID = window.TIFFIN_STORE_ID || 'main';
  const ORDER_STATUS = ['confirmed','preparing','out_for_delivery','reached','delivered','cancelled'];
  const STATUS_COPY = {
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    out_for_delivery: 'On the way',
    reached: 'Reached your location',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    payment_failed: 'Payment failed'
  };
  const LARGE_PROFILE_KEYS = ['TIFFIN_CUSTOMER_AVATAR','CBE_CUSTOMER_AVATAR','cbe_customer_avatar','customer_avatar','cust_avatar','profile_avatar','customer_profile_photo','cust_profile_photo','profile_photo','customerProfilePhoto','customer_photo','cust_photo','user_photo','TIFFIN_PROFILE_PHOTO'];
  const ORDER_KEYS = ['current_order','order_history','TIFFIN_ORDER_HISTORY','cbe_track_selected_order'];
  const STATUS_RANK = {
    cancelled: 100,
    canceled: 100,
    delivered: 90,
    completed: 90,
    reached: 80,
    arrived: 80,
    reached_customer: 80,
    reached_location: 80,
    at_customer: 80,
    picked_up: 70,
    pickup_done: 70,
    out_for_delivery: 70,
    outfordelivery: 70,
    on_the_way: 70,
    on_way: 70,
    preparing: 60,
    cooking: 60,
    ready: 60,
    accepted: 50,
    admin_accepted: 50,
    confirmed_by_restaurant: 50,
    confirmed: 40,
    order_received: 40,
    received: 40,
    placed: 40,
    paid: 35,
    pending: 10
  };

  function clean(value) { return value === null || value === undefined ? '' : String(value).trim(); }
  function parseJSON(value, fallback = null) { try { return JSON.parse(value); } catch (_) { return fallback; } }
  function phone10(value) { const digits = clean(value).replace(/\D/g, ''); return digits.length > 10 ? digits.slice(-10) : digits; }
  function nowISO() { return new Date().toISOString(); }
  function local(key) { try { return clean(localStorage.getItem(key)); } catch (_) { return ''; } }
  function timestampToISO(value) { if (!value) return ''; if (typeof value.toDate === 'function') return value.toDate().toISOString(); if (value.seconds) return new Date(value.seconds * 1000).toISOString(); if (typeof value === 'string') return value; return ''; }
  function normalizeStatusText(value) { return clean(value).toLowerCase().replace(/[\s-]+/g, '_'); }
  function pickOrderStatus(order) {
    const candidates = [order?.adminStatus, order?.orderStatus, order?.deliveryStatus, order?.riderStatus, order?.trackStatus, order?.status].map(normalizeStatusText).filter(Boolean);
    if (!candidates.length) return '';
    return candidates.sort((a, b) => (STATUS_RANK[b] || 0) - (STATUS_RANK[a] || 0))[0];
  }
  function cleanupLargeLocalStorage() {
    try {
      LARGE_PROFILE_KEYS.forEach(key => localStorage.removeItem(key));
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('firestore_mutations_') || key.startsWith('firestore_sequence_number_')) localStorage.removeItem(key);
        if (/avatar|photo|image/i.test(key)) {
          const value = localStorage.getItem(key) || '';
          if (value.length > 250000 && !['TIFFIN_CUSTOMER_PROFILE','customerProfile','CBE_CUSTOMER_PROFILE'].includes(key)) localStorage.removeItem(key);
        }
      });
    } catch (_) {}
  }
  function safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      cleanupLargeLocalStorage();
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (_) {
        console.warn('Storage write skipped', key, error);
        return false;
      }
    }
  }
  function ready() { return !!(window.firebase && window.TIFFIN_FIREBASE_CONFIG && window.TIFFIN_FIREBASE_CONFIG.apiKey); }
  function init() {
    if (!ready()) return null;
    try {
      cleanupLargeLocalStorage();
      if (!firebase.apps.length) firebase.initializeApp(window.TIFFIN_FIREBASE_CONFIG);
      const auth = firebase.auth();
      const db = firebase.firestore();
      return { auth, db };
    } catch (error) {
      console.warn('Firebase init failed', error);
      return null;
    }
  }

  const state = init();
  if (!state) return;
  const { auth, db } = state;
  let activeOrderUnsubscribe = null;
  let historyUnsubscribes = [];

  function uid() { return local('cust_uid') || auth.currentUser?.uid || ''; }
  function userPhone() { return phone10(local('cust_phone') || local('customer_phone') || local('cust_mobile') || auth.currentUser?.phoneNumber || ''); }

  function toast(message) {
    if (!message) return;
    let el = document.getElementById('mvpSyncToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mvpSyncToast';
      el.style.cssText = 'position:fixed;left:50%;bottom:86px;transform:translateX(-50%);width:342px;max-width:calc(100vw - 32px);padding:12px 14px;border-radius:28px;background:#12130F;color:#FDFDFF;font:600 12px General Sans,system-ui;z-index:9999;box-shadow:0 12px 34px rgba(0,0,0,.2);display:none;text-align:center;';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(el.__timer);
    el.__timer = setTimeout(() => { el.style.display = 'none'; }, 2200);
  }

  function readCustomerProfileLocal() {
    const profile = parseJSON(localStorage.getItem('customer_profile'), {}) || parseJSON(localStorage.getItem('TIFFIN_CUSTOMER_PROFILE'), {}) || {};
    return {
      uid: uid() || profile.uid || '',
      name: local('cust_name') || local('customer_name') || local('TIFFIN_CUSTOMER_NAME') || profile.name || '',
      phone: userPhone() || phone10(profile.phone),
      phoneE164: userPhone() ? `+91${userPhone()}` : '',
      email: local('cust_email') || profile.email || '',
      avatarDataUrl: clean(profile.avatarDataUrl || profile.avatar || profile.profilePhoto || ''),
      updatedAtClient: nowISO()
    };
  }

  async function upsertCustomerProfile(extra = {}) {
    const customerId = uid();
    if (!customerId) return null;
    const base = readCustomerProfileLocal();
    const profile = { ...base, ...extra, uid: customerId, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    await db.collection('customers').doc(customerId).set(profile, { merge: true });
    return profile;
  }

  function applyCustomerProfile(profile) {
    if (!profile) return;
    if (profile.name) {
      safeSetItem('cust_name', profile.name);
      safeSetItem('customer_name', profile.name);
      safeSetItem('user_name', profile.name);
      safeSetItem('TIFFIN_CUSTOMER_NAME', profile.name);
    }
    const p = phone10(profile.phone || profile.phoneE164);
    if (p) {
      safeSetItem('cust_phone', p);
      safeSetItem('cust_mobile', p);
      safeSetItem('customer_phone', p);
      safeSetItem('customer_mobile', p);
      safeSetItem('TIFFIN_CUSTOMER_PHONE', p);
    }
    if (profile.email) safeSetItem('cust_email', profile.email);
    safeSetItem('customer_profile', JSON.stringify({ ...profile, phone: p || profile.phone || '', savedAt: nowISO() }));
  }

  async function loadCustomerProfile() {
    const customerId = uid();
    if (!customerId) return null;
    const snap = await db.collection('customers').doc(customerId).get();
    if (!snap.exists) return null;
    const profile = { uid: customerId, ...snap.data() };
    applyCustomerProfile(profile);
    return profile;
  }

  function getSavedLocation() {
    const keys = ['cust_location_details','delivery_location_details','cust_location','delivery_location','cbe_active_delivery_location'];
    for (const key of keys) {
      const data = parseJSON(localStorage.getItem(key), null);
      if (data && typeof data === 'object') return data;
    }
    const fullAddress = local('cust_full_address') || local('delivery_full_address') || local('cust_address') || local('delivery_address');
    if (!fullAddress) return null;
    return { fullAddress, displayAddress: local('cust_address') || local('delivery_address') || fullAddress };
  }

  async function syncAddressToCloud() {
    const customerId = uid();
    const location = getSavedLocation();
    if (!customerId || !location) return;
    await upsertCustomerProfile({ defaultAddress: location, activeDeliveryLocation: location, addressUpdatedAtClient: nowISO() });
  }

  function normalizeCloudOrder(id, data, sourceRank = 0, sourceName = 'remote') {
    if (!data) return null;
    const pickedStatus = pickOrderStatus(data) || 'confirmed';
    const order = { id, ...data };
    order.orderId = data.orderId || id;
    order.createdAt = timestampToISO(data.createdAt) || data.createdAtClient || data.createdAt || nowISO();
    order.updatedAt = timestampToISO(data.updatedAt) || data.updatedAtClient || data.updatedAt || '';
    order.deliveredAt = timestampToISO(data.deliveredAt) || data.deliveredAt || '';
    order.items = Array.isArray(data.items) ? data.items : [];
    order.totals = data.totals || { subtotal: Number(data.subtotal || data.total || 0), delivery: Number(data.delivery || 0), total: Number(data.total || 0) };
    order.total = Number(data.total ?? data.totalPaid ?? data.amount ?? data.totals?.total ?? 0) || 0;
    order.status = pickedStatus;
    order.orderStatus = pickedStatus;
    order.adminStatus = pickedStatus;
    order.deliveryStatus = pickedStatus;
    order.__orderSourceRank = sourceRank;
    order.__orderSource = sourceName;
    return order;
  }

  function stampOrderStatus(order, pickedStatus) {
    if (!order || !pickedStatus) return order;
    order.status = pickedStatus;
    order.orderStatus = pickedStatus;
    order.adminStatus = pickedStatus;
    order.deliveryStatus = pickedStatus;
    return order;
  }

  function mergeCloudOrdersByAuthority({ local = null, customer = null, top = null, store = null } = {}) {
    const merged = { ...(local || {}), ...(customer || {}), ...(top || {}), ...(store || {}) };
    const pickedStatus = pickOrderStatus(store) || pickOrderStatus(top) || pickOrderStatus(customer) || pickOrderStatus(local) || pickOrderStatus(merged) || '';
    const rank = store ? 3 : top ? 2 : customer ? 1 : local ? 0 : 0;
    merged.__orderSourceRank = rank;
    merged.__orderSource = store ? 'store' : top ? 'top' : customer ? 'customer' : 'local';
    return pickedStatus ? stampOrderStatus(merged, pickedStatus) : merged;
  }

  function mergeCloudOrdersBySourceRank(existing, incoming) {
    if (!existing) return incoming || null;
    if (!incoming) return existing;
    const existingRank = Number(existing.__orderSourceRank || 0);
    const incomingRank = Number(incoming.__orderSourceRank || 0);
    const merged = incomingRank >= existingRank ? { ...existing, ...incoming } : { ...incoming, ...existing };
    const pickedStatus = incomingRank >= existingRank
      ? (pickOrderStatus(incoming) || pickOrderStatus(existing) || pickOrderStatus(merged))
      : (pickOrderStatus(existing) || pickOrderStatus(incoming) || pickOrderStatus(merged));
    merged.__orderSourceRank = Math.max(existingRank, incomingRank);
    merged.__orderSource = incomingRank >= existingRank ? (incoming.__orderSource || existing.__orderSource || 'remote') : (existing.__orderSource || incoming.__orderSource || 'remote');
    return pickedStatus ? stampOrderStatus(merged, pickedStatus) : merged;
  }

  async function saveOrderToCloud(order) {
    if (!order || !Array.isArray(order.items) || !order.items.length) return null;
    const customerId = uid() || clean(order.customerId || order.customerUid || order.customer?.uid || '');
    if (!customerId) throw new Error('Customer is not logged in.');
    const profile = readCustomerProfileLocal();
    const orderId = clean(order.id || order.orderId) || `CBE-${Date.now()}`;
    const totals = order.totals || {};
    const pickedStatus = pickOrderStatus(order) || 'confirmed';
    const payload = {
      ...order,
      id: orderId,
      orderId,
      storeId: STORE_ID,
      customerId,
      customerUid: customerId,
      customerName: order.customer?.name || order.customerName || profile.name || 'Customer',
      customerPhone: phone10(order.customer?.contact || order.customer?.phone || order.customerPhone || profile.phone),
      customerEmail: order.customer?.email || order.customerEmail || profile.email || '',
      customer: { ...(order.customer || {}), uid: customerId, id: customerId, phone: phone10(order.customer?.contact || order.customer?.phone || order.customerPhone || profile.phone) },
      address: order.address || order.deliveryLocation?.fullAddress || order.deliveryLocation?.displayAddress || order.deliveryAddress || '',
      status: pickedStatus,
      orderStatus: pickedStatus,
      adminStatus: pickedStatus,
      deliveryStatus: pickedStatus,
      paymentStatus: order.paymentStatus || 'paid',
      paymentProvider: order.paymentProvider || 'razorpay',
      paid: true,
      isPaid: true,
      items: order.items.map(item => ({ id: String(item.id || ''), name: item.name || 'Item', category: item.category || '', price: Number(item.price) || 0, qty: Number(item.qty ?? item.quantity ?? 1) || 1, protein: item.protein || '' })),
      totals: {
        subtotal: Number(totals.subtotal ?? totals.total ?? order.total ?? 0),
        delivery: Number(totals.delivery ?? 0),
        total: Number(totals.total ?? order.total ?? 0),
        totalQty: Number(totals.totalQty ?? order.items.reduce((s, i) => s + (Number(i.qty ?? i.quantity) || 0), 0))
      },
      eta: order.eta || order.etaDisplay || '15 - 25 mins',
      createdAt: order.createdAt && typeof order.createdAt.toDate === 'function' ? order.createdAt : firebase.firestore.FieldValue.serverTimestamp(),
      createdAtClient: order.createdAtClient || order.createdAt || nowISO(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      source: order.source || 'customer_pwa'
    };
    await db.collection('orders').doc(orderId).set(payload, { merge: true });
    await Promise.allSettled([
      db.collection('stores').doc(STORE_ID).collection('orders').doc(orderId).set(payload, { merge: true }),
      db.collection('customers').doc(customerId).collection('orders').doc(orderId).set(payload, { merge: true })
    ]);
    return normalizeCloudOrder(orderId, payload);
  }

  function saveLocalOrders(orders) {
    const sorted = orders.filter(Boolean).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    safeSetItem('order_history', JSON.stringify(sorted));
    safeSetItem('TIFFIN_ORDER_HISTORY', JSON.stringify(sorted));
    const active = sorted.find(order => {
      const status = pickOrderStatus(order) || 'confirmed';
      const paid = order.paymentStatus === 'paid' || order.paid === true || order.isPaid === true || order.paymentId || order.razorpayPaymentId;
      return paid && !['delivered','completed','cancelled','canceled'].includes(status);
    });
    if (active) {
      safeSetItem('current_order', JSON.stringify(active));
      safeSetItem('cbe_track_selected_order', JSON.stringify(active));
    }
    if (typeof window.renderTrack === 'function') window.renderTrack();
    if (typeof window.renderOrders === 'function') window.renderOrders();
    if (typeof window.CBEProfileRefresh === 'function') window.CBEProfileRefresh();
  }

  function listenActiveOrder() {
    const order = parseJSON(localStorage.getItem('current_order'), null);
    const orderId = clean(order?.id || order?.orderId);
    if (!orderId) return null;
    if (activeOrderUnsubscribe) activeOrderUnsubscribe();
    const unsubs = [];
    const snapshots = {};
    function render() {
      const merged = mergeCloudOrdersByAuthority({ local: order, customer: snapshots.customer, top: snapshots.top, store: snapshots.store });
      if (!merged.id && !merged.orderId) return;
      const normalized = normalizeCloudOrder(orderId, merged, merged.__orderSourceRank || 0, merged.__orderSource || 'remote');
      safeSetItem('current_order', JSON.stringify(normalized));
      safeSetItem('cbe_track_selected_order', JSON.stringify(normalized));
      if (typeof window.renderTrack === 'function') window.renderTrack();
      if (typeof window.renderOrders === 'function') window.renderOrders();
      if (typeof window.CBEProfileRefresh === 'function') window.CBEProfileRefresh();
    }
    unsubs.push(db.collection('orders').doc(orderId).onSnapshot(snap => { if (snap.exists) { snapshots.top = { id: snap.id, orderId: snap.id, ...snap.data() }; render(); } }, error => console.warn('Order live sync failed', error)));
    unsubs.push(db.collection('stores').doc(STORE_ID).collection('orders').doc(orderId).onSnapshot(snap => { if (snap.exists) { snapshots.store = { id: snap.id, orderId: snap.id, ...snap.data() }; render(); } }, error => console.warn('Store order live sync failed', error)));
    const customerId = uid() || clean(order.customerId || order.customerUid || order.customer?.uid || '');
    if (customerId) unsubs.push(db.collection('customers').doc(customerId).collection('orders').doc(orderId).onSnapshot(snap => { if (snap.exists) { snapshots.customer = { id: snap.id, orderId: snap.id, ...snap.data() }; render(); } }, error => console.warn('Customer order live sync failed', error)));
    activeOrderUnsubscribe = () => unsubs.forEach(unsub => { try { unsub(); } catch (_) {} });
    return activeOrderUnsubscribe;
  }

  function updateHeaderFromSettings(settings) {
    if (!settings) return;
    const closed = settings.kitchenOpen === false;
    const message = closed ? (settings.closedMessage || 'Kitchen closed. Orders will open soon.') : '';
    let banner = document.getElementById('storeStatusBanner');
    if (!banner && document.querySelector('.hero')) {
      banner = document.createElement('div');
      banner.id = 'storeStatusBanner';
      banner.style.cssText = 'width:342px;max-width:calc(100vw - 48px);padding:10px 12px;border-radius:24px;background:rgba(226,48,9,.10);color:#E23009;font:700 12px General Sans,system-ui;line-height:16px;display:none;';
      document.querySelector('.hero').appendChild(banner);
    }
    if (banner) {
      banner.textContent = message;
      banner.style.display = closed ? 'block' : 'none';
    }
    document.querySelectorAll('.action-btn, .product-list-action, #pay-btn').forEach(btn => {
      if (closed) {
        btn.dataset.storeClosed = '1';
        btn.style.opacity = '0.48';
        btn.style.pointerEvents = 'none';
      } else if (btn.dataset.storeClosed) {
        delete btn.dataset.storeClosed;
        btn.style.opacity = '';
        btn.style.pointerEvents = '';
      }
    });
  }

  function listenStoreSettings() {
    return db.collection('storeSettings').doc(STORE_ID).onSnapshot(snap => {
      if (!snap.exists) return;
      const settings = snap.data();
      safeSetItem('store_settings', JSON.stringify(settings));
      updateHeaderFromSettings(settings);
    }, error => console.warn('Store settings sync failed', error));
  }

  function applyMenuItems(items) {
    if (!Array.isArray(items) || !items.length) return;
    const byId = new Map(items.map(item => [String(item.id || item.docId), item]));
    try {
      if (typeof products !== 'undefined' && Array.isArray(products)) {
        products.forEach(product => {
          const cloudItem = byId.get(String(product.id));
          if (!cloudItem) return;
          if (cloudItem.name) product.name = cloudItem.name;
          if (cloudItem.price !== undefined) product.price = Number(cloudItem.price) || product.price;
          if (cloudItem.category) product.category = cloudItem.category;
          if (cloudItem.protein) product.protein = cloudItem.protein;
          product.available = cloudItem.available !== false;
        });
        if (typeof renderAllCartButtons === 'function') renderAllCartButtons();
      }
    } catch (_) {}
    document.querySelectorAll('[data-product-id]').forEach(btn => {
      const cloudItem = byId.get(String(btn.dataset.productId));
      if (!cloudItem) return;
      const card = btn.closest('.product-card, .product-list-item');
      if (card) {
        const amount = card.querySelector('.amount');
        if (amount && cloudItem.price !== undefined) amount.textContent = String(Number(cloudItem.price) || 0);
        card.style.display = cloudItem.available === false ? 'none' : '';
      }
    });
  }

  function listenMenuItems() {
    return db.collection('menuItems').onSnapshot(snapshot => {
      const items = snapshot.docs.map(doc => ({ docId: doc.id, id: doc.data().id || doc.id, ...doc.data() }));
      safeSetItem('menu_catalog', JSON.stringify(items));
      applyMenuItems(items);
    }, error => console.warn('Menu sync failed', error));
  }

  function subscribeQuery(query, bucket, callback, sourceRank = 0, sourceName = 'remote') {
    return query.limit(30).onSnapshot(snapshot => {
      bucket.items = snapshot.docs.map(doc => normalizeCloudOrder(doc.id, doc.data(), sourceRank, sourceName)).filter(Boolean);
      callback();
    }, error => console.warn(`${sourceName} order history sync failed`, error));
  }

  function loadOrderHistory() {
    const customerId = uid();
    const phone = userPhone();
    if (!customerId && !phone) return null;
    historyUnsubscribes.forEach(unsub => { try { unsub(); } catch (_) {} });
    historyUnsubscribes = [];
    const buckets = [];
    function render() {
      const map = new Map();
      buckets.flatMap(bucket => bucket.items || []).forEach(order => {
        const id = clean(order.id || order.orderId);
        if (!id) return;
        map.set(id, mergeCloudOrdersBySourceRank(map.get(id), order));
      });
      saveLocalOrders(Array.from(map.values()));
    }
    const storeOrders = db.collection('stores').doc(STORE_ID).collection('orders');
    if (customerId) {
      [
        { query: db.collection('orders').where('customerId', '==', customerId), sourceRank: 2, sourceName: 'top' },
        { query: db.collection('orders').where('customerUid', '==', customerId), sourceRank: 2, sourceName: 'top' },
        { query: storeOrders.where('customerId', '==', customerId), sourceRank: 3, sourceName: 'store' },
        { query: storeOrders.where('customerUid', '==', customerId), sourceRank: 3, sourceName: 'store' },
        { query: db.collection('customers').doc(customerId).collection('orders'), sourceRank: 1, sourceName: 'customer' }
      ].forEach(entry => {
        const bucket = { items: [] };
        buckets.push(bucket);
        historyUnsubscribes.push(subscribeQuery(entry.query, bucket, render, entry.sourceRank, entry.sourceName));
      });
    }
    if (phone) {
      [
        { query: db.collection('orders').where('customerPhone', '==', phone), sourceRank: 2, sourceName: 'top' },
        { query: storeOrders.where('customerPhone', '==', phone), sourceRank: 3, sourceName: 'store' }
      ].forEach(entry => {
        const bucket = { items: [] };
        buckets.push(bucket);
        historyUnsubscribes.push(subscribeQuery(entry.query, bucket, render, entry.sourceRank, entry.sourceName));
      });
    }
    return () => historyUnsubscribes.forEach(unsub => { try { unsub(); } catch (_) {} });
  }

  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function patchedSetItem(key, value) {
    try { originalSetItem(key, value); } catch (error) { cleanupLargeLocalStorage(); try { originalSetItem(key, value); } catch (_) { console.warn('Storage write skipped', key, error); return; } }
    try {
      if (['customer_profile','TIFFIN_CUSTOMER_PROFILE','CBE_CUSTOMER_PROFILE','cust_name','cust_email'].includes(key)) upsertCustomerProfile().catch(error => console.warn('Profile cloud sync failed', error));
      if (['cust_location_details','delivery_location_details','cust_location','delivery_location','cbe_active_delivery_location','cust_full_address','delivery_full_address'].includes(key)) syncAddressToCloud().catch(error => console.warn('Address cloud sync failed', error));
    } catch (error) {
      console.warn('Local sync hook failed', error);
    }
  };

  async function boot() {
    auth.onAuthStateChanged(async user => {
      if (!user) return;
      safeSetItem('cust_uid', user.uid);
      const p = phone10(user.phoneNumber);
      if (p && !localStorage.getItem('cust_phone')) {
        safeSetItem('cust_phone', p);
        safeSetItem('cust_mobile', p);
        safeSetItem('customer_phone', p);
        safeSetItem('TIFFIN_CUSTOMER_PHONE', p);
      }
      try {
        const profile = await loadCustomerProfile();
        if (!profile) await upsertCustomerProfile();
        if (typeof window.renderProfile === 'function') window.renderProfile();
      } catch (error) {
        console.warn('Customer profile boot sync failed', error);
      }
      loadOrderHistory();
      listenActiveOrder();
    });
    listenStoreSettings();
    listenMenuItems();
  }

  window.TiffinMVP = {
    auth,
    db,
    ORDER_STATUS,
    STATUS_COPY,
    cleanupLargeLocalStorage,
    safeSetItem,
    pickOrderStatus,
    upsertCustomerProfile,
    loadCustomerProfile,
    syncAddressToCloud,
    saveOrderToCloud,
    listenActiveOrder,
    listenStoreSettings,
    listenMenuItems,
    toast
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
