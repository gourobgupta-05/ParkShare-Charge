/**
 * Turn-by-Turn Smart In-App Navigation Engine (Module 1 — Maidul Islam)
 *
 * Generates a route + ETA from the driver's current coordinates to a
 * booking's destination coordinates. Uses Mapbox Directions API when
 * MAPBOX_ACCESS_TOKEN is set and MOCK_NAVIGATION !== "true"; otherwise
 * falls back to a deterministic mock so the rest of the app can be built
 * and demoed without a real key.
 */

const MOCK_NAVIGATION =
  process.env.MOCK_NAVIGATION === "true" || !process.env.MAPBOX_ACCESS_TOKEN;

// Haversine distance in km — used by the mock to produce a plausible ETA
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

async function getRoute({ origin, destination }) {
  if (!origin || !destination || origin.lat == null || destination.lat == null) {
    const err = new Error("origin and destination {lat,lng} are required");
    err.status = 400;
    throw err;
  }

  if (MOCK_NAVIGATION) {
    const distanceKm = Number(haversineKm(origin, destination).toFixed(2));
    const avgSpeedKmh = 22; // assumed urban Dhaka average
    const durationMin = Math.max(2, Math.round((distanceKm / avgSpeedKmh) * 60));

    return {
      mode: "mock",
      distanceKm,
      durationMin,
      etaTimestamp: new Date(Date.now() + durationMin * 60_000).toISOString(),
      // Simple straight-line polyline placeholder (two points) — real API
      // would return a full turn-by-turn geometry.
      geometry: {
        type: "LineString",
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
      },
      steps: [
        { instruction: "Head toward destination", distanceKm },
        { instruction: "Arrive at destination", distanceKm: 0 },
      ],
    };
  }

  // Real Mapbox Directions API call
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?geometries=geojson&steps=true&overview=full&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`Mapbox request failed: ${res.status}`);
    err.status = 502;
    throw err;
  }
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) {
    const err = new Error("No route found");
    err.status = 404;
    throw err;
  }

  return {
    mode: "mapbox",
    distanceKm: Number((route.distance / 1000).toFixed(2)),
    durationMin: Math.round(route.duration / 60),
    etaTimestamp: new Date(Date.now() + route.duration * 1000).toISOString(),
    geometry: route.geometry,
    steps: route.legs[0].steps.map((s) => ({
      instruction: s.maneuver.instruction,
      distanceKm: Number((s.distance / 1000).toFixed(2)),
    })),
  };
}

module.exports = { getRoute, haversineKm, MOCK_NAVIGATION };
