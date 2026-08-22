/**
 * ETA CACHE — OWNER: Maidul Islam [MI]
 *
 * The navigation UI refreshes the ETA every ~15 seconds while the driver is
 * moving. Without a cache that is one Mapbox Directions call per driver per
 * 15 seconds, which burns the free tier in an afternoon.
 *
 * Keyed on booking + a coarse geohash of the origin, so a driver sitting in
 * traffic reuses the cached route while genuine movement misses the cache and
 * re-routes. In-memory on purpose: this is disposable data, and Render's free
 * tier has no Redis.
 */
const TTL_SECONDS = Number(process.env.NAV_ETA_CACHE_TTL_SECONDS) || 60;
const MAX_ENTRIES = 500;

const store = new Map();

/** ~11 m of precision at 4 decimals — finer than that is GPS noise. */
function coarseKey(bookingId, origin) {
  return `${bookingId}:${origin.lat.toFixed(4)}:${origin.lng.toFixed(4)}`;
}

function get(bookingId, origin) {
  const key = coarseKey(bookingId, origin);
  const hit = store.get(key);
  if (!hit) return null;

  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return { ...hit.value, cached: true };
}

function set(bookingId, origin, value) {
  // Cheap bound: drop the oldest entry rather than growing without limit.
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  store.set(coarseKey(bookingId, origin), {
    value,
    expiresAt: Date.now() + TTL_SECONDS * 1000,
  });
  return value;
}

/** Called when a booking ends so stale routes do not linger. */
function invalidate(bookingId) {
  for (const key of store.keys()) {
    if (key.startsWith(`${bookingId}:`)) store.delete(key);
  }
}

const stats = () => ({ entries: store.size, ttlSeconds: TTL_SECONDS });

module.exports = { get, set, invalidate, stats };
