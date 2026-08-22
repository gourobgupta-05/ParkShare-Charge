/**
 * bKASH SANDBOX ADAPTER (STUB) — OWNER: Tamal Deb Nath [TDN]
 *
 * Interface complete, credentials pending merchant approval. bKash sandbox
 * access requires merchant onboarding that regularly takes weeks, so this
 * adapter reports itself unconfigured and gateways/index.js falls back to the
 * mock. When credentials arrive, fill in the two fetch calls below and set
 * PAYMENT_PROVIDER=bkash — no other file changes.
 */
const isConfigured = () =>
  Boolean(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET && process.env.BKASH_USERNAME);

async function grantToken() {
  // POST {BKASH_SANDBOX_BASE_URL}/tokenized/checkout/token/grant
  throw new Error('bKash credentials are not configured yet');
}

async function initiateTopUp() {
  throw new Error('bKash sandbox is pending merchant approval — set PAYMENT_PROVIDER=mock or sslcz');
}

async function verifyTopUp() {
  throw new Error('bKash sandbox is pending merchant approval');
}

async function tokenize({ user, method }) {
  return { token: `bkash_pending_${String(user?._id || '').slice(-8)}`, method };
}

module.exports = { name: 'bkash', isConfigured, grantToken, initiateTopUp, verifyTopUp, tokenize };
