/**
 * ============================================================================
 * NAVIGATION SERVICE — OWNER: Maidul Islam [MI]
 * ============================================================================
 * Turn-by-turn routing to the host's exact entrance after a booking is
 * confirmed.
 *
 * WHY THE ENTRANCE, NOT THE PIN
 * Property.location is the map pin — usually the middle of the building. For a
 * mall basement or a gated residential compound, driving to the pin puts you
 * at a wall. Property.entranceLocation is the gate the driver must actually
 * reach, so routing targets that and falls back to the pin only when the host
 * never set one.
 *
 * Booking fields written here are only the ones [MI] owns:
 *   navigation.{routeId, etaSeconds, distanceMeters, startedAt}
 * plus the CONFIRMED → EN_ROUTE transition, which the shared state machine
 * names this feature as the writer of.
 * ============================================================================
 */
const crypto = require('crypto');
const { Booking, Property } = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { BOOKING_STATUS, ROLES, ERROR_CODES } = require('../../shared/constants');
const { getDirectionsProvider } = require('./providers');
const etaCache = require('./etaCache.service');

/** Distance at which the driver counts as arrived, in metres. */
const ARRIVAL_RADIUS_M = Number(process.env.NAV_ARRIVAL_RADIUS_M) || 60;

/* ------------------------------------------------------------------------ */
/* Helpers                                                                  */
/* ------------------------------------------------------------------------ */

/** Loads the booking, checks the requester is on it, and returns the target. */
async function loadNavigableBooking(bookingId, userId, role) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('That booking no longer exists');

  const isDriver = String(booking.driverId) === String(userId);
  const isHost = String(booking.hostId) === String(userId);
  if (!isDriver && !isHost && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You are not a party to this booking');
  }

  const property = await Property.findById(booking.propertyId)
    .select('title address location entranceLocation propertyType operatingHours')
    .lean();
  if (!property) throw ApiError.notFound('That space no longer exists');

  const entrance = property.entranceLocation?.coordinates?.length === 2
    ? property.entranceLocation
    : property.location;

  const destination = {
    lng: entrance.coordinates[0],
    lat: entrance.coordinates[1],
    instructions: property.entranceLocation?.instructions || null,
    usedEntrance: Boolean(property.entranceLocation?.coordinates?.length === 2),
  };

  return { booking, property, destination, isDriver };
}

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

/* ------------------------------------------------------------------------ */
/* Operations                                                               */
/* ------------------------------------------------------------------------ */

/** Where the driver is headed, without computing a route. */
async function getDestination({ bookingId, userId, role }) {
  const { booking, property, destination } = await loadNavigableBooking(bookingId, userId, role);

  return {
    bookingId: booking._id,
    status: booking.status,
    destination,
    property: {
      _id: property._id,
      title: property.title,
      address: property.address,
      propertyType: property.propertyType,
    },
    navigation: booking.navigation,
  };
}

/**
 * Builds the route and flips the booking to EN_ROUTE.
 * Only bookings that are paid for can be navigated — routing an unpaid booking
 * would hand out a host's exact gate coordinates to anyone who tapped "book".
 */
async function startRoute({ bookingId, userId, role, origin }) {
  const { booking, property, destination, isDriver } = await loadNavigableBooking(
    bookingId,
    userId,
    role
  );

  if (!isDriver && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only the driver on this booking can start navigation');
  }

  const navigable = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.EN_ROUTE, BOOKING_STATUS.ACTIVE];
  if (!navigable.includes(booking.status)) {
    throw ApiError.badRequest(
      booking.status === BOOKING_STATUS.PENDING_PAYMENT
        ? 'Pay for this booking before starting navigation'
        : `This booking is ${booking.status.toLowerCase().replace(/_/g, ' ')} and cannot be navigated`,
      ERROR_CODES.BOOKING_STATE_INVALID
    );
  }

  const provider = getDirectionsProvider();
  let route;
  try {
    route = await provider.getRoute({ origin, destination, profile: origin.profile });
  } catch (err) {
    throw new ApiError(
      err.statusCode || 502,
      err.message || 'Could not work out a route to that entrance',
      ERROR_CODES.INTERNAL
    );
  }

  const routeId = crypto.randomBytes(8).toString('hex');

  booking.navigation = {
    routeId,
    etaSeconds: route.durationSeconds,
    distanceMeters: route.distanceMeters,
    startedAt: booking.navigation?.startedAt || new Date(),
  };

  // CONFIRMED -> EN_ROUTE. Already-active bookings keep their status; the
  // state machine names geofence check-in as the writer of ACTIVE, not us.
  if (booking.status === BOOKING_STATUS.CONFIRMED) {
    booking.transitionTo(BOOKING_STATUS.EN_ROUTE);
  }
  await booking.save();

  const payload = {
    bookingId: booking._id,
    routeId,
    status: booking.status,
    provider: route.provider,
    isSimulated: route.isSimulated,
    distanceMeters: route.distanceMeters,
    etaSeconds: route.durationSeconds,
    etaAt: new Date(Date.now() + route.durationSeconds * 1000),
    geometry: route.geometry,
    steps: route.steps,
    destination,
    property: { _id: property._id, title: property.title, address: property.address },
  };

  etaCache.set(String(booking._id), origin, payload);
  logger.info(`[navigation] route ${routeId} via ${route.provider} for booking ${booking._id}`);

  return payload;
}

/**
 * Cheap ETA refresh while driving. Serves from cache when the driver has not
 * meaningfully moved, and reports arrival once inside ARRIVAL_RADIUS_M.
 */
async function refreshEta({ bookingId, userId, role, origin }) {
  const cached = etaCache.get(String(bookingId), origin);
  const { booking, destination } = await loadNavigableBooking(bookingId, userId, role);

  const straightLineMeters = Math.round(haversineMeters(origin, destination));
  const hasArrived = straightLineMeters <= ARRIVAL_RADIUS_M;

  if (hasArrived) {
    return {
      bookingId: booking._id,
      hasArrived: true,
      straightLineMeters,
      etaSeconds: 0,
      etaAt: new Date(),
      message: 'You have arrived at the entrance',
      // Check-in itself belongs to the geofence feature — we only report it.
      nextStep: 'CHECK_IN',
    };
  }

  if (cached) {
    return { ...cached, hasArrived: false, straightLineMeters, cached: true };
  }

  const provider = getDirectionsProvider();
  const route = await provider.getRoute({ origin, destination, profile: origin.profile });

  const payload = {
    bookingId: booking._id,
    routeId: booking.navigation?.routeId || null,
    provider: route.provider,
    isSimulated: route.isSimulated,
    distanceMeters: route.distanceMeters,
    etaSeconds: route.durationSeconds,
    etaAt: new Date(Date.now() + route.durationSeconds * 1000),
    geometry: route.geometry,
    steps: route.steps,
    destination,
    hasArrived: false,
    straightLineMeters,
  };

  etaCache.set(String(booking._id), origin, payload);

  // Keep the stored ETA roughly current for the host's dashboard.
  await Booking.updateOne(
    { _id: booking._id },
    {
      $set: {
        'navigation.etaSeconds': route.durationSeconds,
        'navigation.distanceMeters': route.distanceMeters,
      },
    }
  );

  return payload;
}

/** Cancels navigation without touching booking status. */
async function stopRoute({ bookingId, userId, role }) {
  const { booking } = await loadNavigableBooking(bookingId, userId, role);
  etaCache.invalidate(String(booking._id));

  await Booking.updateOne(
    { _id: booking._id },
    { $set: { 'navigation.etaSeconds': null, 'navigation.distanceMeters': null } }
  );

  return { bookingId: booking._id, stopped: true };
}

/** Which router is live — surfaced in the UI so a simulated route is honest. */
function providerStatus() {
  const provider = getDirectionsProvider();
  return {
    provider: provider.name,
    isSimulated: provider.name === 'mock',
    profile: process.env.NAV_PROFILE || 'driving-traffic',
    cache: etaCache.stats(),
  };
}

module.exports = {
  getDestination,
  startRoute,
  refreshEta,
  stopRoute,
  providerStatus,
  haversineMeters,
  ARRIVAL_RADIUS_M,
};
