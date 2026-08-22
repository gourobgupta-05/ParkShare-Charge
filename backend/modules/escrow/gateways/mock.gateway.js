/**
 * MOCK PAYMENT GATEWAY — OWNER: Tamal Deb Nath [TDN]
 * Default provider. No third-party account, no network call, fully offline.
 * Behaves like a real gateway: issues a token, requires an explicit verify
 * step, and can be made to fail on demand so error paths are demonstrable.
 *
 * Force a failure in the demo by sending amountPoisha === 1 (৳0.01).
 */
const crypto = require('crypto');

const isConfigured = () => true;

const newToken = (prefix) => `${prefix}_${crypto.randomBytes(12).toString('hex')}`;

async function initiateTopUp({ amountPoisha, user, reference }) {
  const token = newToken('mocktxn');
  return {
    provider: 'mock',
    token,
    amountPoisha,
    // A real gateway would return its hosted checkout URL. The mock points back
    // at our own confirm endpoint so the flow is identical end to end.
    redirectUrl: `/wallet?mockToken=${token}&amount=${amountPoisha}`,
    reference,
    customerRef: user?.email || null,
    requiresRedirect: false,
  };
}

async function verifyTopUp({ token, payload = {} }) {
  if (!token || !String(token).startsWith('mocktxn_')) {
    return { success: false, reason: 'Unrecognised transaction token', token, raw: payload };
  }
  const amountPoisha = Number(payload.amountPoisha || 0);
  if (amountPoisha === 1) {
    return { success: false, reason: 'Simulated gateway decline', token, amountPoisha, raw: payload };
  }
  return { success: true, amountPoisha, token, raw: { simulated: true, ...payload } };
}

/** Returns an opaque token; we never persist a real instrument number. */
async function tokenize({ user, method }) {
  return { token: newToken('tok'), method, ownerRef: String(user?._id || '') };
}

module.exports = { name: 'mock', isConfigured, initiateTopUp, verifyTopUp, tokenize };
