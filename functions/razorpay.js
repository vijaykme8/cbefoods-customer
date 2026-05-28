let accessTokenCache = null;

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origin || '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-razorpay-signature',
      'cache-control': 'no-store'
    }
  });
}

function bad(message, status = 400, origin = '') {
  return json({ ok: false, message }, status, origin);
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(item => item.trim()).filter(Boolean);
  if (!origin) return '';
  if (allowed.includes(origin)) return origin;
  try {
    const url = new URL(origin);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return origin;
    if (url.hostname === 'customer-dev.cbefoods-customer.pages.dev') return origin;
    if (url.hostname === 'cbefoods-customer.pages.dev') return origin;
    if (url.hostname.endsWith('.cbefoods-customer.pages.dev')) return origin;
  } catch (_) {}
  return origin;
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}


function envText(env, ...names) {
  for (const name of names) {
    const value = env && env[name];
    const cleaned = text(value);
    if (cleaned) return cleaned;
  }
  return '';
}

function phone10(value) {
  const digits = text(value).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function number(value, fallback = 0) {
  const out = Number(value);
  return Number.isFinite(out) ? out : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix = 'id') {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const value = Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${Date.now()}_${value}`;
}

function base64(input) {
  if (typeof btoa === 'function') return btoa(input);
  return Buffer.from(input, 'utf8').toString('base64');
}

function base64Url(input) {
  const raw = typeof input === 'string' ? input : JSON.stringify(input);
  return base64(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return bytesToHex(sig);
}

function constantEqual(a, b) {
  const left = text(a);
  const right = text(b);
  if (!left || !right || left.length !== right.length) return false;
  let out = 0;
  for (let i = 0; i < left.length; i += 1) out |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return out === 0;
}

async function verifyPaymentSignature(env, razorpayOrderId, paymentId, signature) {
  const secret = envText(env, 'RAZORPAY_KEY_SECRET');
  const expected = await hmacHex(secret, `${razorpayOrderId}|${paymentId}`);
  return constantEqual(expected, signature);
}

async function verifyWebhookSignature(env, rawBody, signature) {
  const webhookSecret = envText(env, 'RAZORPAY_WEBHOOK_SECRET');
  if (!webhookSecret) return false;
  const expected = await hmacHex(webhookSecret, rawBody);
  return constantEqual(expected, signature);
}

function getServiceAccount(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing.');
  const data = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!data.client_email || !data.private_key) throw new Error('Invalid Firebase service account.');
  return data;
}

function pemToArrayBuffer(pem) {
  const clean = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const binary = typeof atob === 'function' ? atob(clean) : Buffer.from(clean, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const unsigned = `${base64Url(header)}.${base64Url(claim)}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(serviceAccount.private_key.replace(/\\n/g, '\n')), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(String.fromCharCode(...new Uint8Array(signature)))}`;
}

async function getAccessToken(env) {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60000) return accessTokenCache.token;
  const serviceAccount = getServiceAccount(env);
  const jwt = await signJwt(serviceAccount);
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Google token failed.');
  accessTokenCache = { token: data.access_token, expiresAt: Date.now() + number(data.expires_in, 3300) * 1000 };
  return data.access_token;
}

function projectId(env) {
  if (env.FIREBASE_PROJECT_ID) return env.FIREBASE_PROJECT_ID;
  return getServiceAccount(env).project_id;
}

function valueToFirestore(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(valueToFirestore) } };
  if (typeof value === 'object') {
    const fields = {};
    Object.entries(value).forEach(([key, val]) => { fields[key] = valueToFirestore(val); });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function firestoreToValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(firestoreToValue);
  if ('mapValue' in value) {
    const out = {};
    Object.entries(value.mapValue.fields || {}).forEach(([key, val]) => { out[key] = firestoreToValue(val); });
    return out;
  }
  return null;
}

function docToObject(doc) {
  if (!doc || !doc.fields) return null;
  const out = {};
  Object.entries(doc.fields).forEach(([key, value]) => { out[key] = firestoreToValue(value); });
  return out;
}

async function firestoreFetch(env, path, options = {}) {
  const token = await getAccessToken(env);
  const response = await fetch(path, { ...options, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || data.error || `Firestore request failed ${response.status}`);
  return data;
}

function firestoreBase(env) {
  return `https://firestore.googleapis.com/v1/projects/${projectId(env)}/databases/(default)/documents`;
}

async function getDoc(env, docPath) {
  try {
    const data = await firestoreFetch(env, `${firestoreBase(env)}/${docPath}`);
    return docToObject(data);
  } catch (error) {
    if (String(error.message || '').includes('NOT_FOUND')) return null;
    return null;
  }
}

async function setDoc(env, docPath, data) {
  const fields = {};
  const params = new URLSearchParams();
  Object.entries(data || {}).forEach(([key, value]) => {
    fields[key] = valueToFirestore(value);
    params.append('updateMask.fieldPaths', key);
  });
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return firestoreFetch(env, `${firestoreBase(env)}/${docPath}${suffix}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
}

async function findCheckoutIntentByRazorpayOrderId(env, razorpayOrderId) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'checkoutIntents' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'razorpayOrderId' },
          op: 'EQUAL',
          value: { stringValue: razorpayOrderId }
        }
      },
      limit: 1
    }
  };
  const rows = await firestoreFetch(env, `${firestoreBase(env)}:runQuery`, { method: 'POST', body: JSON.stringify(body) });
  const row = Array.isArray(rows) ? rows.find(item => item.document) : null;
  if (!row) return null;
  const checkoutId = row.document.name.split('/').pop();
  return { checkoutId, data: docToObject(row.document) };
}

function razorpayAuth(env) {
  const keyId = envText(env, 'RAZORPAY_KEY_ID');
  const keySecret = envText(env, 'RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys are missing in Cloudflare Pages Functions runtime. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET as runtime variables/secrets for Preview, then redeploy.');
  }
  return `Basic ${base64(`${keyId}:${keySecret}`)}`;
}

async function createRazorpayOrder(env, payload) {
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { authorization: razorpayAuth(env), 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.description || data.error?.reason || 'Razorpay order creation failed.');
  return data;
}

async function fetchRazorpayPayment(env, paymentId) {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { authorization: razorpayAuth(env) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.description || data.error?.reason || 'Razorpay payment fetch failed.');
  return data;
}

async function fetchCapturedPaymentForOrder(env, razorpayOrderId) {
  const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpayOrderId)}/payments`, { headers: { authorization: razorpayAuth(env) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  const items = Array.isArray(data.items) ? data.items : [];
  return items.find(item => item.status === 'captured') || items[0] || null;
}

function sanitizeDraft(raw) {
  const draft = raw && typeof raw === 'object' ? raw : {};
  const items = Array.isArray(draft.items) ? draft.items.map(item => ({
    id: text(item.id || item.itemId || item.name).slice(0, 80),
    name: text(item.name || 'Item').slice(0, 120),
    category: text(item.category || '').slice(0, 80),
    price: number(item.price),
    qty: Math.max(1, number(item.qty, 1)),
    protein: text(item.protein || '').slice(0, 80),
    image: text(item.image || '').slice(0, 300)
  })).filter(item => item.name && item.qty > 0) : [];
  const total = Math.round(number(draft.total || draft.totals?.total));
  const customerPhone = phone10(draft.customerPhone || draft.customer?.phone || draft.customer?.contact);
  const customerName = text(draft.customerName || draft.customer?.name || 'Customer').slice(0, 80);
  const customerId = text(draft.customerId || draft.customer?.id || draft.customer?.uid || '').slice(0, 120);
  const deliveryAddress = text(draft.deliveryAddress || draft.address || draft.deliveryLocation?.fullAddress || draft.deliveryLocation?.displayAddress).slice(0, 900);
  if (!items.length) throw new Error('Cart is empty.');
  if (!total || total < 1) throw new Error('Invalid order total.');
  if (!deliveryAddress) throw new Error('Delivery address is missing.');
  return {
    ...draft,
    items,
    total,
    customerId,
    customerName,
    customerPhone,
    customerEmail: text(draft.customerEmail || draft.customer?.email || '').slice(0, 120),
    deliveryAddress,
    address: deliveryAddress,
    totals: {
      ...(draft.totals || {}),
      subtotal: Math.round(number(draft.totals?.subtotal ?? draft.itemTotal ?? total)),
      delivery: Math.round(number(draft.totals?.delivery ?? draft.deliveryFee ?? 0)),
      tax: Math.round(number(draft.totals?.tax ?? draft.tax ?? 0)),
      total,
      totalQty: Math.max(1, Math.round(number(draft.totals?.totalQty ?? draft.totalQty ?? items.reduce((sum, item) => sum + item.qty, 0))))
    },
    customer: {
      ...(draft.customer || {}),
      id: customerId,
      uid: customerId,
      name: customerName,
      phone: customerPhone,
      contact: customerPhone,
      email: text(draft.customerEmail || draft.customer?.email || '').slice(0, 120)
    },
    source: 'customer_pwa',
    sanitizedAt: nowIso()
  };
}

function buildPaidOrder(intent, payment, source = 'frontend') {
  const draft = intent.draft || {};
  const now = nowIso();
  const orderId = text(intent.finalOrderId || intent.orderId || draft.id || `CBE-${Date.now()}`);
  return {
    ...draft,
    id: orderId,
    orderId,
    storeId: intent.storeId || 'main',
    customerId: text(draft.customerId || draft.customer?.id || draft.customer?.uid || ''),
    customerName: text(draft.customerName || draft.customer?.name || 'Customer'),
    customerPhone: phone10(draft.customerPhone || draft.customer?.phone || draft.customer?.contact),
    customerEmail: text(draft.customerEmail || draft.customer?.email || ''),
    status: 'confirmed',
    orderStatus: 'confirmed',
    adminStatus: 'confirmed',
    paymentStatus: 'paid',
    paymentProvider: 'Razorpay',
    paymentId: text(payment.id || payment.razorpay_payment_id || intent.paymentId || ''),
    razorpayPaymentId: text(payment.id || payment.razorpay_payment_id || intent.paymentId || ''),
    razorpayOrderId: text(payment.order_id || intent.razorpayOrderId || ''),
    razorpaySignatureVerified: true,
    paidAt: payment.created_at ? new Date(number(payment.created_at) * 1000).toISOString() : now,
    createdAt: draft.createdAt || now,
    createdAtClient: draft.createdAt || now,
    updatedAt: now,
    paymentFinalizedAt: now,
    paymentFinalizeSource: source,
    adminVisible: true,
    checkoutId: intent.checkoutId,
    receipt: intent.receipt || draft.receipt || '',
    items: Array.isArray(draft.items) ? draft.items : [],
    totals: draft.totals || { total: number(draft.total) },
    total: number(draft.total || draft.totals?.total)
  };
}

async function savePaidOrder(env, intent, payment, source = 'frontend') {
  if (intent.status === 'finalized' && intent.finalOrderId) {
    const saved = await getDoc(env, `orders/${intent.finalOrderId}`);
    if (saved) return saved;
  }
  const order = buildPaidOrder(intent, payment, source);
  await setDoc(env, `orders/${order.orderId}`, order);
  await setDoc(env, `stores/${order.storeId || 'main'}/orders/${order.orderId}`, order);
  if (order.customerId) {
    await setDoc(env, `customers/${order.customerId}/orders/${order.orderId}`, order);
    await setDoc(env, `customers/${order.customerId}`, {
      uid: order.customerId,
      phone: order.customerPhone || '',
      name: order.customerName || '',
      lastOrderId: order.orderId,
      lastOrderAt: order.paidAt || nowIso(),
      updatedAt: nowIso()
    });
  }
  await setDoc(env, `checkoutIntents/${intent.checkoutId}`, {
    ...intent,
    status: 'finalized',
    finalOrderId: order.orderId,
    paymentId: order.paymentId,
    paidAt: order.paidAt,
    finalizedAt: nowIso(),
    finalizeSource: source
  });
  return order;
}

async function handleCreateOrder(request, env, origin) {
  const body = await request.json().catch(() => ({}));
  const draft = sanitizeDraft(body.order || body.snapshot || body);
  const checkoutId = randomId('checkout');
  const receipt = `rcpt_${checkoutId.slice(-24)}`;
  const amountPaise = Math.max(100, Math.round(number(draft.total) * 100));
  const storeId = text(body.storeId || env.STORE_ID || 'main') || 'main';
  const razorpayOrder = await createRazorpayOrder(env, {
    amount: amountPaise,
    currency: 'INR',
    receipt,
    notes: {
      checkoutId,
      customerId: draft.customerId || '',
      customerPhone: draft.customerPhone ? `****${draft.customerPhone.slice(-4)}` : '',
      source: 'customer_pwa'
    }
  });
  const orderId = text(draft.id || `CBE-${Date.now()}`);
  const intent = {
    checkoutId,
    orderId,
    receipt,
    storeId,
    status: 'checkout_created',
    adminVisible: false,
    amountPaise,
    currency: 'INR',
    razorpayOrderId: razorpayOrder.id,
    draft: { ...draft, id: orderId, orderId, receipt },
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await setDoc(env, `checkoutIntents/${checkoutId}`, intent);
  return json({ ok: true, keyId: envText(env, 'RAZORPAY_KEY_ID'), checkoutId, orderId, razorpayOrderId: razorpayOrder.id, amount: amountPaise, currency: 'INR', receipt }, 200, origin);
}

async function handleFinalize(request, env, origin) {
  const body = await request.json().catch(() => ({}));
  const checkoutId = text(body.checkoutId);
  const razorpayOrderId = text(body.razorpay_order_id || body.razorpayOrderId);
  const paymentId = text(body.razorpay_payment_id || body.paymentId);
  const signature = text(body.razorpay_signature || body.signature);
  if (!checkoutId || !razorpayOrderId || !paymentId || !signature) return bad('Payment confirmation is incomplete.', 400, origin);
  const intent = await getDoc(env, `checkoutIntents/${checkoutId}`);
  if (!intent) return bad('Checkout intent not found.', 404, origin);
  intent.checkoutId = checkoutId;
  if (intent.status === 'finalized' && intent.finalOrderId) return json({ ok: true, orderId: intent.finalOrderId, order: await getDoc(env, `orders/${intent.finalOrderId}`) }, 200, origin);
  if (intent.razorpayOrderId !== razorpayOrderId) return bad('Razorpay order mismatch.', 400, origin);
  const signatureOk = await verifyPaymentSignature(env, razorpayOrderId, paymentId, signature);
  if (!signatureOk) return bad('Payment signature verification failed.', 400, origin);
  const payment = await fetchRazorpayPayment(env, paymentId);
  if (payment.order_id !== razorpayOrderId) return bad('Payment order mismatch.', 400, origin);
  if (payment.status !== 'captured') return bad('Payment is not captured yet.', 409, origin);
  if (number(payment.amount) !== number(intent.amountPaise)) return bad('Payment amount mismatch.', 400, origin);
  const order = await savePaidOrder(env, intent, payment, 'frontend_finalize');
  return json({ ok: true, orderId: order.orderId, order }, 200, origin);
}

async function handleStatus(request, env, origin) {
  const url = new URL(request.url);
  const checkoutId = text(url.searchParams.get('checkoutId'));
  if (!checkoutId) return bad('checkoutId is required.', 400, origin);
  const intent = await getDoc(env, `checkoutIntents/${checkoutId}`);
  if (!intent) return bad('Checkout intent not found.', 404, origin);
  if (intent.status === 'finalized' && intent.finalOrderId) return json({ ok: true, status: 'finalized', orderId: intent.finalOrderId, order: await getDoc(env, `orders/${intent.finalOrderId}`) }, 200, origin);
  return json({ ok: true, status: intent.status || 'pending', orderId: '' }, 200, origin);
}

async function handleWebhook(request, env, origin) {
  const signature = request.headers.get('x-razorpay-signature') || '';
  const rawBody = await request.text();
  const verified = await verifyWebhookSignature(env, rawBody, signature);
  if (!verified) return bad('Invalid webhook signature.', 401, origin);
  const body = JSON.parse(rawBody || '{}');
  const event = text(body.event);
  let payment = body.payload?.payment?.entity || null;
  let razorpayOrderId = text(payment?.order_id || body.payload?.order?.entity?.id || '');
  if (!payment && razorpayOrderId) payment = await fetchCapturedPaymentForOrder(env, razorpayOrderId);
  if (!payment || !razorpayOrderId || !['payment.captured', 'order.paid'].includes(event)) return json({ ok: true, ignored: true }, 200, origin);
  if (payment.status !== 'captured') return json({ ok: true, ignored: true, status: payment.status || '' }, 200, origin);
  const found = await findCheckoutIntentByRazorpayOrderId(env, razorpayOrderId);
  if (!found) return json({ ok: true, ignored: true, reason: 'checkout_intent_not_found' }, 200, origin);
  const intent = { ...found.data, checkoutId: found.checkoutId };
  if (number(payment.amount) !== number(intent.amountPaise)) return bad('Webhook payment amount mismatch.', 400, origin);
  const order = await savePaidOrder(env, intent, payment, 'razorpay_webhook');
  return json({ ok: true, orderId: order.orderId }, 200, origin);
}

export async function onRequestOptions({ request, env }) {
  return json({ ok: true }, 200, allowedOrigin(request, env));
}

export async function onRequest({ request, env }) {
  const origin = allowedOrigin(request, env);
  try {
    const url = new URL(request.url);
    const action = text(url.searchParams.get('action'));
    if (request.method === 'OPTIONS') return json({ ok: true }, 200, origin);
    if (request.method === 'GET' && action === 'status') return await handleStatus(request, env, origin);
    if (request.method !== 'POST') return bad('Method not allowed.', 405, origin);
    if (action === 'create-order') return await handleCreateOrder(request, env, origin);
    if (action === 'finalize') return await handleFinalize(request, env, origin);
    if (action === 'webhook') return await handleWebhook(request, env, origin);
    return bad('Unknown Razorpay action.', 404, origin);
  } catch (error) {
    return bad(error.message || 'Razorpay function failed.', 500, origin);
  }
}
