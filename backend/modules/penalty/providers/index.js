/**
 * PUSH PROVIDER REGISTRY — OWNER: S. Moontaha Rahman [SMR]
 *
 * Selected by PUSH_PROVIDER (mock | firebase). Falls back to the mock whenever
 * Firebase credentials are absent, so swapping in a real project is a one-line
 * .env change and never a code change.
 */
const mock = require('./mock.push.provider');
const firebase = require('./firebase.push.provider');
const logger = require('../../../utils/logger');

const ADAPTERS = { mock, firebase, fcm: firebase };

let warned = false;

function getPushProvider(name) {
  const requested = String(name || process.env.PUSH_PROVIDER || 'mock').toLowerCase();
  const adapter = ADAPTERS[requested];

  if (!adapter) {
    if (!warned) {
      logger.warn(`[push] unknown PUSH_PROVIDER "${requested}", using the mock provider`);
      warned = true;
    }
    return mock;
  }

  if (!adapter.isConfigured()) {
    if (!warned) {
      logger.warn(`[push] ${requested} is not configured — notifications are logged, not delivered`);
      warned = true;
    }
    return mock;
  }

  return adapter;
}

module.exports = { getPushProvider, ADAPTERS };
