/**
 * PAYMENT GATEWAY ADAPTER REGISTRY — OWNER: Tamal Deb Nath [TDN]
 *
 * Selected by PAYMENT_PROVIDER in backend/.env: mock | sslcz | bkash.
 * Every adapter exposes the same three functions, so swapping a mock for a
 * real sandbox is a one-line .env change and never a code change:
 *
 *   initiateTopUp({ amountPoisha, user, reference })  -> { redirectUrl, token, provider }
 *   verifyTopUp({ token, payload })                   -> { success, amountPoisha, token, raw }
 *   tokenize({ user, method })                        -> { token }   (never stores real card/wallet numbers)
 */
const mock = require('./mock.gateway');
const sslcommerz = require('./sslcommerz.gateway');
const bkash = require('./bkash.gateway.stub');

const ADAPTERS = { mock, sslcz: sslcommerz, sslcommerz, bkash };

function getGateway(name) {
  const key = String(name || process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();
  const adapter = ADAPTERS[key];
  if (!adapter) {
    // Never crash checkout because of a bad env value — fall back loudly.
    // eslint-disable-next-line no-console
    console.warn(`[escrow] unknown PAYMENT_PROVIDER "${key}", falling back to mock`);
    return mock;
  }
  if (typeof adapter.isConfigured === 'function' && !adapter.isConfigured()) {
    // eslint-disable-next-line no-console
    console.warn(`[escrow] ${key} gateway is not configured, falling back to mock`);
    return mock;
  }
  return adapter;
}

module.exports = { getGateway, ADAPTERS };
