/**
 * MOCK PUSH PROVIDER — OWNER: S. Moontaha Rahman [SMR]
 *
 * Default provider. No Firebase project, no network call. Logs the payload and
 * reports success, so every penalty path is demonstrable without credentials.
 * The in-app Notification record is written by the caller either way, which is
 * what the bell icon reads — so the user still sees the alert.
 */
const logger = require('../../../utils/logger');

const isConfigured = () => true;

async function send({ tokens = [], title, body, data = {} }) {
  logger.info(`[push:mock] "${title}" -> ${tokens.length} device(s) :: ${body}`);
  return {
    provider: 'mock',
    successCount: tokens.length,
    failureCount: 0,
    simulated: true,
    invalidTokens: [],
    data,
  };
}

module.exports = { name: 'mock', isConfigured, send };
