/* =========================================================
   Tiffin CBE Firebase + Firestore MVP Sync Layer
   Requires:
   - firebase-config.js
   - firebase-app-compat.js
   - firebase-auth-compat.js
   - firebase-firestore-compat.js
========================================================= */
(function () {
  const STORE_ID = window.TIFFIN_STORE_ID || "main";
  const ORDER_STATUS = ["confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];
  const STATUS_COPY = {
    confirmed: "Confirmed",
    preparing: "Preparing",
    out_for_delivery: "On the way",
    delivered: "Delivered",
    cancelled: "Cancelled",
    payment_failed: "Payment failed"
  };

  function ready() {
    return !!(window.firebase && window.TIFFIN_FIREBASE_CONFIG && window.TIFFIN_FIREBASE_CONFIG.apiKey);
  }

  function init() {
    if (!ready()) return null;
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.TIFFIN_FIREBASE_CONFIG);
      const auth = firebase.auth();
      const db = firebase.firestore();
      try { db.enablePersistence({ synchronizeTabs: true }); } catch (e) {}
      return { auth, db };
    } catch (error) {
      console.warn("Firebase init failed", error);
      return null;
    }
  }

  const state = init();
  if (!state) return;
  const { auth, db } = state;

  function clean(value) { return value === null || value === undefined ? "" : String(value).trim(); }
  function phone10(value) {
    const digits = clean(value).replace(/\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
  }
  function parseJSON(value, fallback = null) {
    try { return JSON.parse(value); } catch (e) { return fallback; }
  }
  function local(key) { return clean(localStorage.getItem(key)); }
  function uid() { return local("cust_uid") || auth.currentUser?.uid || ""; }
  function userPhone() { return phone10(local("cust_phone") || local("cust_mobile") || auth.currentUser?.phoneNumber || ""); }
  function nowISO() { return new Date().toISOString(); }
  function toast(message) {
    if (!message) return;
    let el = document.getElementById("mvpSyncToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "mvpSyncToast";
      el.style.cssText = "position:fixed;left:50%;bottom:86px;transform:translateX(-50%);width:342px;max-width:calc(100vw - 32px);padding:12px 14px;border-radius:28px;background:#12130F;color:#FDFDFF;font:600 12px General Sans,system-ui;z-index:9999;box-shadow:0 12px 34px rgba(0,0,0,.2);display:none;text-align:center;";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.display = "block";
    clearTimeout(el.__timer);
    el.__timer = setTimeout(() => { el.style.display = "none"; }, 2200);
  }

  function timestampToISO(value) {
    if (!value) return "";
    if (typeof value.toDate === "function") return value.toDate().toISOString();
    if (value.seconds) return new Date(value.seconds * 1000).toISOString();
    if (typeof value === "string") return value;
    return "";
  }

  function normalizeCloudOrder(id, data) {
    if (!data) return null;
    const order = { id, ...data };
    order.createdAt = timestampToISO(data.createdAt) || data.createdAt || nowISO();
    order.updatedAt = timestampToISO(data.updatedAt) || data.updatedAt || "";
    order.items = Array.isArray(data.items) ? data.items : [];
    order.totals = data.totals || {
      subtotal: Number(data.subtotal || data.total || 0),
      delivery: Number(data.delivery || 0),
      total: Number(data.total || 0)
    };
    return order;
  }

  function readCustomerProfileLocal() {
    const profile = parseJSON(localStorage.getItem("customer_profile"), {}) || {};
    return {
      uid: uid() || profile.uid || "",
      name: local("cust_name") || local("customer_name") || profile.name || "",
      phone: userPhone() || phone10(profile.phone),
      phoneE164: userPhone() ? `+91${userPhone()}` : "",
      email: local("cust_email") || profile.email || "",
      updatedAtClient: nowISO()
    };
  }

  async function upsertCustomerProfile(extra = {}) {
    const customerId = uid();
    if (!customerId) return null;
    const base = readCustomerProfileLocal();
    const profile = { ...base, ...extra, uid: customerId, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    await db.collection("customers").doc(customerId).set(profile, { merge: true });
    return profile;
  }

  function applyCustomerProfile(profile) {
    if (!profile) return;
    if (profile.name) {
      localStorage.setItem("cust_name", profile.name);
      localStorage.setItem("customer_name", profile.name);
      localStorage.setItem("user_name", profile.name);
    }
    const p = phone10(profile.phone || profile.phoneE164);
    if (p) {
      localStorage.setItem("cust_phone", p);
      localStorage.setItem("cust_mobile", p);
      localStorage.setItem("customer_phone", p);
      localStorage.setItem("customer_mobile", p);
    }
    if (profile.email) localStorage.setItem("cust_email", profile.email);
    localStorage.setItem("customer_profile", JSON.stringify({ ...profile, phone: p || profile.phone || "", savedAt: nowISO() }));
  }

  async function loadCustomerProfile() {
    const customerId = uid();
    if (!customerId) return null;
    const snap = await db.collection("customers").doc(customerId).get();
    if (!snap.exists) return null;
    const profile = { uid: customerId, ...snap.data() };
    applyCustomerProfile(profile);
    return profile;
  }

  function getSavedLocation() {
    const keys = ["cust_location_details", "delivery_location_details", "cust_location", "delivery_location"];
    for (const key of keys) {
      const data = parseJSON(localStorage.getItem(key), null);
      if (data && typeof data === "object") return data;
    }
    const fullAddress = local("cust_full_address") || local("delivery_full_address") || local("cust_address") || local("delivery_address");
    if (!fullAddress) return null;
    return { fullAddress, displayAddress: local("cust_address") || local("delivery_address") || fullAddress };
  }

  async function syncAddressToCloud() {
    const customerId = uid();
    const location = getSavedLocation();
    if (!customerId || !location) return;
    await upsertCustomerProfile({ defaultAddress: location, addressUpdatedAtClient: nowISO() });
  }

  async function saveOrderToCloud(order) {
    if (!order || !Array.isArray(order.items) || !order.items.length) return null;
    const customerId = uid();
    if (!customerId) throw new Error("Customer is not logged in.");
    const profile = readCustomerProfileLocal();
    const orderId = clean(order.id) || `CBE${Date.now()}`;
    const totals = order.totals || {};
    const payload = {
      ...order,
      id: orderId,
      storeId: STORE_ID,
      customerId,
      customerName: order.customer?.name || profile.name || "Customer",
      customerPhone: phone10(order.customer?.contact || profile.phone),
      customerEmail: order.customer?.email || profile.email || "",
      customer: { ...(order.customer || {}), uid: customerId, phone: phone10(order.customer?.contact || profile.phone) },
      address: order.address || order.deliveryLocation?.fullAddress || order.deliveryLocation?.displayAddress || "",
      status: order.status || "confirmed",
      paymentStatus: order.paymentStatus || "paid",
      paymentProvider: order.paymentProvider || "razorpay",
      items: order.items.map(item => ({
        id: String(item.id || ""),
        name: item.name || "Item",
        category: item.category || "",
        price: Number(item.price) || 0,
        qty: Number(item.qty) || 1,
        protein: item.protein || ""
      })),
      totals: {
        subtotal: Number(totals.subtotal ?? totals.total ?? 0),
        delivery: Number(totals.delivery ?? 0),
        total: Number(totals.total ?? 0),
        totalQty: Number(totals.totalQty ?? order.items.reduce((s, i) => s + (Number(i.qty) || 0), 0))
      },
      eta: order.eta || "15 - 25 mins",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAtClient: order.createdAt || nowISO(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      source: "customer_pwa"
    };
    await db.collection("orders").doc(orderId).set(payload, { merge: true });
    const localOrder = { ...order, id: orderId, customerId, status: payload.status, paymentStatus: payload.paymentStatus };
    return localOrder;
  }

  let suppressSetItem = false;
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function patchedSetItem(key, value) {
    originalSetItem(key, value);
    if (suppressSetItem) return;
    try {
      if (key === "current_order") {
        const order = parseJSON(value, null);
        if (order) saveOrderToCloud(order).catch(error => console.warn("Order cloud sync failed", error));
      }
      if (["customer_profile", "cust_name", "cust_email"].includes(key)) {
        upsertCustomerProfile().catch(error => console.warn("Profile cloud sync failed", error));
      }
      if (["cust_location_details", "delivery_location_details", "cust_location", "delivery_location", "cust_full_address", "delivery_full_address"].includes(key)) {
        syncAddressToCloud().catch(error => console.warn("Address cloud sync failed", error));
      }
    } catch (error) {
      console.warn("Local sync hook failed", error);
    }
  };

  function saveLocalOrder(order) {
    suppressSetItem = true;
    try { originalSetItem("current_order", JSON.stringify(order)); } finally { suppressSetItem = false; }
  }

  function listenActiveOrder() {
    const order = parseJSON(localStorage.getItem("current_order"), null);
    const orderId = clean(order?.id);
    if (!orderId) return null;
    return db.collection("orders").doc(orderId).onSnapshot(snap => {
      if (!snap.exists) return;
      const cloudOrder = normalizeCloudOrder(snap.id, snap.data());
      saveLocalOrder(cloudOrder);
      if (typeof window.renderTrack === "function") window.renderTrack();
      if (typeof window.renderOrders === "function") window.renderOrders();
    }, error => console.warn("Order live sync failed", error));
  }

  function updateHeaderFromSettings(settings) {
    if (!settings) return;
    const closed = settings.kitchenOpen === false;
    const message = closed ? (settings.closedMessage || "Kitchen closed. Orders will open soon.") : "";
    let banner = document.getElementById("storeStatusBanner");
    if (!banner && document.querySelector(".hero")) {
      banner = document.createElement("div");
      banner.id = "storeStatusBanner";
      banner.style.cssText = "width:342px;max-width:calc(100vw - 48px);padding:10px 12px;border-radius:24px;background:rgba(226,48,9,.10);color:#E23009;font:700 12px General Sans,system-ui;line-height:16px;display:none;";
      document.querySelector(".hero").appendChild(banner);
    }
    if (banner) {
      banner.textContent = message;
      banner.style.display = closed ? "block" : "none";
    }
    document.querySelectorAll(".action-btn, .product-list-action, #pay-btn").forEach(btn => {
      if (closed) {
        btn.dataset.storeClosed = "1";
        btn.style.opacity = "0.48";
        btn.style.pointerEvents = "none";
      } else if (btn.dataset.storeClosed) {
        delete btn.dataset.storeClosed;
        btn.style.opacity = "";
        btn.style.pointerEvents = "";
      }
    });
  }

  function listenStoreSettings() {
    return db.collection("storeSettings").doc(STORE_ID).onSnapshot(snap => {
      if (!snap.exists) return;
      const settings = snap.data();
      localStorage.setItem("store_settings", JSON.stringify(settings));
      updateHeaderFromSettings(settings);
    }, error => console.warn("Store settings sync failed", error));
  }

  function applyMenuItems(items) {
    if (!Array.isArray(items) || !items.length) return;
    const byId = new Map(items.map(item => [String(item.id || item.docId), item]));
    // Update the existing static products array if this page has it.
    try {
      if (typeof products !== "undefined" && Array.isArray(products)) {
        products.forEach(product => {
          const cloudItem = byId.get(String(product.id));
          if (!cloudItem) return;
          if (cloudItem.name) product.name = cloudItem.name;
          if (cloudItem.price !== undefined) product.price = Number(cloudItem.price) || product.price;
          if (cloudItem.category) product.category = cloudItem.category;
          if (cloudItem.protein) product.protein = cloudItem.protein;
          product.available = cloudItem.available !== false;
        });
        if (typeof renderAllCartButtons === "function") renderAllCartButtons();
      }
    } catch (e) {}

    document.querySelectorAll("[data-product-id]").forEach(btn => {
      const cloudItem = byId.get(String(btn.dataset.productId));
      if (!cloudItem) return;
      const card = btn.closest(".product-card, .product-list-item");
      if (card) {
        const amount = card.querySelector(".amount");
        if (amount && cloudItem.price !== undefined) amount.textContent = String(Number(cloudItem.price) || 0);
        card.style.display = cloudItem.available === false ? "none" : "";
      }
    });
  }

  function listenMenuItems() {
    return db.collection("menuItems").onSnapshot(snapshot => {
      const items = snapshot.docs.map(doc => ({ docId: doc.id, id: doc.data().id || doc.id, ...doc.data() }));
      localStorage.setItem("menu_catalog", JSON.stringify(items));
      applyMenuItems(items);
    }, error => console.warn("Menu sync failed", error));
  }

  function loadOrderHistory() {
    const customerId = uid();
    if (!customerId) return null;
    return db.collection("orders")
      .where("customerId", "==", customerId)
      .orderBy("createdAt", "desc")
      .limit(20)
      .onSnapshot(snapshot => {
        const orders = snapshot.docs.map(doc => normalizeCloudOrder(doc.id, doc.data())).filter(Boolean);
        suppressSetItem = true;
        try { originalSetItem("order_history", JSON.stringify(orders)); } finally { suppressSetItem = false; }
        if (typeof window.renderOrders === "function") window.renderOrders();
      }, error => console.warn("Order history sync failed", error));
  }

  async function boot() {
    auth.onAuthStateChanged(async user => {
      if (user) {
        localStorage.setItem("cust_uid", user.uid);
        const p = phone10(user.phoneNumber);
        if (p && !localStorage.getItem("cust_phone")) {
          localStorage.setItem("cust_phone", p);
          localStorage.setItem("cust_mobile", p);
        }
        try {
          const profile = await loadCustomerProfile();
          if (!profile) await upsertCustomerProfile();
          if (typeof window.renderProfile === "function") window.renderProfile();
        } catch (error) {
          console.warn("Customer profile boot sync failed", error);
        }
        loadOrderHistory();
        listenActiveOrder();
      }
    });
    listenStoreSettings();
    listenMenuItems();
  }

  window.TiffinMVP = {
    auth,
    db,
    ORDER_STATUS,
    STATUS_COPY,
    upsertCustomerProfile,
    loadCustomerProfile,
    syncAddressToCloud,
    saveOrderToCloud,
    listenActiveOrder,
    listenStoreSettings,
    listenMenuItems,
    toast
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
