/**
 * MAPBOX DIRECTIONS PROVIDER — OWNER: Maidul Islam [MI]
 *
 * Real turn-by-turn routing. The SERVER token (MAPBOX_SERVER_TOKEN) is used
 * here and never leaves the backend — the browser only ever sees the
 * URL-restricted public token used for rendering tiles. Routing therefore
 * cannot be scraped from the client bundle.
 *
 * If the token is absent, providers/index.js falls back to the mock, so the
 * navigation feature still works end to end without a Mapbox account.
 */
const BASE_URL = process.env.MAPBOX_DIRECTIONS_URL || 'https://api.mapbox.com/directions/v5/mapbox';

const isConfigured = () => Boolean(process.env.MAPBOX_SERVER_TOKEN);

/** Strips the HTML Mapbox sometimes embeds in banner instructions. */
const clean = (text) => String(text || '').replace(/<[^>]*>/g, '').trim();

async function getRoute({ origin, destination, profile = 'driving-traffic' }) {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const params = new URLSearchParams({
    access_token: process.env.MAPBOX_SERVER_TOKEN,
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    language: 'en',
    alternatives: 'false',
  });

  const response = await fetch(`${BASE_URL}/${profile}/${coords}?${params}`);
  if (!response.ok) {
    const error = new Error(`Mapbox routing failed with status ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  const json = await response.json();
  if (json.code !== 'Ok' || !json.routes?.length) {
    const error = new Error(json.message || 'No route could be found to that entrance');
    error.statusCode = 422;
    throw error;
  }

  const route = json.routes[0];
  const steps = (route.legs?.[0]?.steps || []).map((s) => ({
    instruction: clean(s.maneuver?.instruction),
    distanceMeters: Math.round(s.distance),
    durationSeconds: Math.round(s.duration),
    maneuver: s.maneuver?.type || 'continue',
  }));

  return {
    provider: 'mapbox',
    profile,
    distanceMeters: Math.round(route.distance),
    durationSeconds: Math.round(route.duration),
    geometry: route.geometry,
    steps,
    isSimulated: false,
  };
}

module.exports = { name: 'mapbox', isConfigured, getRoute };
