/**
 * SSLCOMMERZ SANDBOX ADAPTER — OWNER: Tamal Deb Nath [TDN]
 *
 * Real sandbox integration for wallet top-up only. Credentials come from
 * backend/.env (SSLCZ_STORE_ID / SSLCZ_STORE_PASSWD) — nothing is hardcoded.
 * If they are absent, gateways/index.js silently falls back to the mock, so
 * the app keeps working without a sandbox account.
 *
 * Escrow itself is NOT routed through here: no sandbox offers marketplace
 * split settlement. Escrow is an internal double-entry ledger (see
 * escrowHold.transaction.js), which is what makes the ACID demo possible.
 */
const { poishaToTaka } = require('../../../utils/money');

const cfg = () => ({
  storeId: process.env.SSLCZ_STORE_ID,
  storePasswd: process.env.SSLCZ_STORE_PASSWD,
  baseUrl: process.env.SSLCZ_SANDBOX_BASE_URL || 'https://sandbox.sslcommerz.com',
  successUrl: process.env.SSLCZ_SUCCESS_URL,
  failUrl: process.env.SSLCZ_FAIL_URL,
  ipnUrl: process.env.SSLCZ_IPN_URL,
});

const isConfigured = () => Boolean(cfg().storeId && cfg().storePasswd);

async function initiateTopUp({ amountPoisha, user, reference }) {
  const c = cfg();
  const body = new URLSearchParams({
    store_id: c.storeId,
    store_passwd: c.storePasswd,
    total_amount: String(poishaToTaka(amountPoisha)),
    currency: 'BDT',
    tran_id: reference,
    success_url: c.successUrl || '',
    fail_url: c.failUrl || '',
    cancel_url: c.failUrl || '',
    ipn_url: c.ipnUrl || '',
    cus_name: user?.name || 'ParkShare user',
    cus_email: user?.email || 'noreply@parkshare.test',
    cus_phone: user?.phone || '01700000000',
    cus_add1: 'Dhaka',
    cus_city: 'Dhaka',
    cus_country: 'Bangladesh',
    shipping_method: 'NO',
    product_name: 'ParkShare wallet top-up',
    product_category: 'service',
    product_profile: 'non-physical-goods',
  });

  const response = await fetch(`${c.baseUrl}/gwprocess/v4/api.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await response.json();

  if (json.status !== 'SUCCESS' || !json.GatewayPageURL) {
    const error = new Error(json.failedreason || 'SSLCommerz refused the transaction');
    error.statusCode = 502;
    throw error;
  }

  return {
    provider: 'sslcz',
    token: json.sessionkey,
    amountPoisha,
    redirectUrl: json.GatewayPageURL,
    reference,
    requiresRedirect: true,
  };
}

async function verifyTopUp({ token, payload = {} }) {
  const c = cfg();
  const url =
    `${c.baseUrl}/validator/api/validationserverAPI.php` +
    `?val_id=${encodeURIComponent(payload.val_id || token)}` +
    `&store_id=${encodeURIComponent(c.storeId)}` +
    `&store_passwd=${encodeURIComponent(c.storePasswd)}&format=json`;

  const response = await fetch(url);
  const json = await response.json();
  const validated = json.status === 'VALID' || json.status === 'VALIDATED';

  return {
    success: validated,
    reason: validated ? null : json.status || 'Validation failed',
    token,
    amountPoisha: Math.round(Number(json.amount || 0) * 100),
    raw: json,
  };
}

async function tokenize({ user, method }) {
  // SSLCommerz does not expose vaulting on the sandbox tier; we store only an
  // opaque local reference, never an instrument number.
  return { token: `sslcz_ref_${String(user?._id || '').slice(-8)}_${Date.now()}`, method };
}

module.exports = { name: 'sslcz', isConfigured, initiateTopUp, verifyTopUp, tokenize };
