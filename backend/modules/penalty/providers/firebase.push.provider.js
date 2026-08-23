/**
 * FIREBASE CLOUD MESSAGING PROVIDER — OWNER: S. Moontaha Rahman [SMR]
 *
 * Talks to FCM HTTP v1 directly rather than pulling in firebase-admin. The SDK
 * is ~20 MB of transitive dependencies for what is, at this scale, one signed
 * JWT and one POST — and Render's free tier has little room to spare.
 *
 * Credentials come from the environment and are never hardcoded:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * FIREBASE_PRIVATE_KEY arrives from a .env file with literal "\n" sequences
 * rather than real newlines. Unescaping it is the single most common reason
 * FCM integrations fail on first deploy, so it is handled explicitly below.
 */
const crypto = require('crypto');
const logger = require('../../../utils/logger');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

const isConfigured = () =>
  Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );

/** Turns the escaped .env value back into a usable PEM. */
function privateKey() {
  return String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

const base64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cachedToken = null;

/** Mints (and caches) a short-lived OAuth2 access token from the service account. */
async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: process.env.FIREBASE_CLIENT_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(privateKey(), 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });

  const json = await response.json();
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || 'Firebase authentication failed');
  }

  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

/**
 * FCM v1 sends to one token per request, so tokens are fanned out. Dead tokens
 * are reported back so the caller can prune them from the user document.
 */
async function send({ tokens = [], title, body, data = {} }) {
  if (!tokens.length) return { provider: 'fcm', successCount: 0, failureCount: 0, invalidTokens: [] };

  const accessToken = await getAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`;

  let successCount = 0;
  const invalidTokens = [];

  await Promise.all(
    tokens.map(async (token) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              // FCM requires every data value to be a string.
              data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
              webpush: { fcmOptions: { link: data.deepLink || '/' } },
            },
          }),
        });

        if (response.ok) {
          successCount += 1;
          return;
        }

        const error = await response.json().catch(() => ({}));
        const status = error?.error?.status;
        if (status === 'NOT_FOUND' || status === 'INVALID_ARGUMENT') invalidTokens.push(token);
        logger.warn(`[push:fcm] delivery failed: ${status || response.status}`);
      } catch (err) {
        logger.warn(`[push:fcm] request failed: ${err.message}`);
      }
    })
  );

  return {
    provider: 'fcm',
    successCount,
    failureCount: tokens.length - successCount,
    invalidTokens,
    simulated: false,
  };
}

module.exports = { name: 'fcm', isConfigured, send, getAccessToken };
