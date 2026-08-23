/**
 * DIRECTIONS PROVIDER REGISTRY — OWNER: Maidul Islam [MI]
 *
 * Selected by NAV_PROVIDER (mapbox | mock). Defaults to mapbox when a server
 * token exists, otherwise the mock. Swapping is a one-line .env change and
 * never a code change.
 */
const mapbox = require('./mapbox.directions.provider');
const mock = require('./mock.directions.provider');
const logger = require('../../../utils/logger');

const ADAPTERS = { mapbox, mock };

let warned = false;

function getDirectionsProvider(name) {
  const requested = String(name || process.env.NAV_PROVIDER || '').toLowerCase();

  if (requested && ADAPTERS[requested]) {
    const adapter = ADAPTERS[requested];
    if (adapter.isConfigured()) return adapter;
    if (!warned) {
      logger.warn(`[navigation] ${requested} provider is not configured, using the simulated router`);
      warned = true;
    }
    return mock;
  }

  if (mapbox.isConfigured()) return mapbox;

  if (!warned) {
    logger.warn('[navigation] MAPBOX_SERVER_TOKEN is not set — routes are simulated');
    warned = true;
  }
  return mock;
}

module.exports = { getDirectionsProvider, ADAPTERS };
