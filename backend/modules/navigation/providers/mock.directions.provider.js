/**
 * MOCK DIRECTIONS PROVIDER — OWNER: Maidul Islam [MI]
 *
 * Default provider. No Mapbox account, no network call, fully offline.
 * Produces a plausible route so the whole navigation flow — path, ETA,
 * turn list, arrival — is demonstrable without a token.
 *
 * The geometry is a great-circle interpolation between origin and entrance
 * with a slight lateral offset, so it reads as a road rather than a ruler
 * line on the map. Distances use haversine; duration assumes Dhaka traffic.
 */
const DHAKA_AVG_SPEED_KMH = Number(process.env.NAV_MOCK_SPEED_KMH) || 18;

const isConfigured = () => true;

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function bearing(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const compassOf = (deg) => COMPASS[Math.round(deg / 45) % 8];

async function getRoute({ origin, destination, profile }) {
  const straight = haversineMeters(origin, destination);
  // Real streets are never straight — a 1.35 detour factor is typical for Dhaka.
  const distanceMeters = Math.round(straight * 1.35);
  const durationSeconds = Math.max(
    Math.round((distanceMeters / 1000 / DHAKA_AVG_SPEED_KMH) * 3600),
    60
  );

  const POINTS = 24;
  const coordinates = [];
  for (let i = 0; i <= POINTS; i += 1) {
    const t = i / POINTS;
    // Sine bow gives the polyline a road-like curve instead of a ruler line.
    const bow = Math.sin(t * Math.PI) * 0.0009;
    coordinates.push([
      origin.lng + (destination.lng - origin.lng) * t + bow,
      origin.lat + (destination.lat - origin.lat) * t - bow * 0.4,
    ]);
  }

  const heading = bearing(origin, destination);
  const legDistance = Math.round(distanceMeters / 3);
  const legDuration = Math.round(durationSeconds / 3);

  const steps = [
    {
      instruction: `Head ${compassOf(heading)} toward the main road`,
      distanceMeters: legDistance,
      durationSeconds: legDuration,
      maneuver: 'depart',
    },
    {
      instruction: 'Continue straight, then keep right at the junction',
      distanceMeters: legDistance,
      durationSeconds: legDuration,
      maneuver: 'continue',
    },
    {
      instruction: 'Arrive at the parking entrance',
      distanceMeters: distanceMeters - legDistance * 2,
      durationSeconds: durationSeconds - legDuration * 2,
      maneuver: 'arrive',
    },
  ];

  return {
    provider: 'mock',
    profile,
    distanceMeters,
    durationSeconds,
    geometry: { type: 'LineString', coordinates },
    steps,
    isSimulated: true,
  };
}

module.exports = { name: 'mock', isConfigured, getRoute, haversineMeters };
