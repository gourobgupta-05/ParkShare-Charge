/**
 * ============================================================================
 * GEOFENCED CHECK-IN — OWNER: S. Moontaha Rahman [SMR]
 * ============================================================================
 * The 15-metre trigger that flips a booking to ACTIVE.
 *
 * This module is the SOLE WRITER of CONFIRMED/EN_ROUTE → ACTIVE. The shared
 * state machine names it as such, and every other feature reads that status
 * rather than setting it: the IoT broker refuses to meter a booking that is
 * not ACTIVE, and the penalty worker measures overstay from the check-in.
 *
 * WHY ACCURACY IS CHECKED, NOT JUST DISTANCE
 * A phone reporting "you are 8 m away, ±200 m" has told you nothing. Browser
 * geolocation routinely returns 50-2000 m accuracy indoors and in basement car
 * parks — exactly where this feature runs. Accepting a check-in on a reading
 * whose error bar dwarfs the geofence would let a driver check in from home.
 * So a coarse fix is rejected with a specific message, and the QR entry pass
 * exists as the deliberate fallback for underground parking with no GPS.
 * ============================================================================
 */
const mongoose = require('mongoose');
const { Booking, Property } = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const {
  BOOKING_STATUS, PLATFORM, ERROR_CODES, NOTIFICATION_TYPE, ROLES,
} = require('../../shared/constants');
const { notify } = require('../penalty/notify.service');

const GEOFENCE_RADIUS_M = Number(process.env.GEOFENCE_RADIUS_M) || PLATFORM.GEOFENCE_RADIUS_M;
const MIN_ACCURACY_M = Number(process.env.GEOFENCE_MIN_ACCURACY_M) || 50;
const ALLOW_MOCK_LOCATION = process.env.ALLOW_MOCK_LOCATION === 'true';

/** Statuses a driver can check in from. */
const CHECKIN_FROM = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.EN_ROUTE];

/* ------------------------------------------------------------------------ */
/* Geometry                                                                 */
/* ------------------------------------------------------------------------ */

/** Great-circle distance in metres. */
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

/** The geofence centre: the host's gate if pinned, otherwise the map pin. */
function targetOf(property) {
  const entrance =
    property.entranceLocation?.coordinates?.length === 2
      ? property.entranceLocation
      : property.location;

  return {
    lng: entrance.coordinates[0],
    lat: entrance.coordinates[1],
    usedEntrance: property.entranceLocation?.coordinates?.length === 2,
    instructions: property.entranceLocation?.instructions || null,
  };
}

/**
 * Pure evaluation — no database, no side effects, so it is trivially testable.
 * @returns {{distanceMeters:number, isInside:boolean, accuracyOk:boolean, canCheckIn:boolean, reason:string|null}}
 */
function evaluateProximity({ target, coords, radiusM = GEOFENCE_RADIUS_M }) {
  const distanceMeters = Math.round(haversineMeters(coords, target));
  const isInside = distanceMeters <= radiusM;

  const accuracy = Number(coords.accuracy);
  // An unreported accuracy is treated as acceptable; a reported bad one is not.
  const accuracyOk = !Number.isFinite(accuracy) || accuracy <= MIN_ACCURACY_M;

  let reason = null;
  if (!isInside) {
    reason = `You are ${distanceMeters} m away. Move within ${radiusM} m of the entrance to check in.`;
  } else if (!accuracyOk) {
    reason =
      `Your location is only accurate to ${Math.round(accuracy)} m, which is too coarse to confirm ` +
      'you are at the entrance. Step outside for a better signal, or use your entry pass.';
  }

  return {
    distanceMeters,
    radiusM,
    isInside,
    accuracyM: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
    accuracyOk,
    canCheckIn: isInside && accuracyOk,
    reason,
  };
}

/* ------------------------------------------------------------------------ */
/* Loading                                                                  */
/* ------------------------------------------------------------------------ */

async function loadBooking(bookingId, userId, role) {
  if (!mongoose.isValidObjectId(bookingId)) throw ApiError.badRequest('That is not a valid booking id');

  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('That booking no longer exists');

  const isDriver = String(booking.driverId) === String(userId);
  const isHost = String(booking.hostId) === String(userId);
  if (!isDriver && !isHost && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You are not a party to this booking');
  }

  const property = await Property.findById(booking.propertyId)
    .select('title address location entranceLocation propertyType hostId')
    .lean();
  if (!property) throw ApiError.notFound('That space no longer exists');

  return { booking, property, isDriver, isHost };
}

/* ------------------------------------------------------------------------ */
/* The transition                                                           */
/* ------------------------------------------------------------------------ */

/**
 * Flips the booking to ACTIVE inside a transaction.
 *
 * Writes only [SMR]-owned fields: booking.checkIn.* and the status transition.
 * Idempotent — a second ping from a driver already inside the fence returns
 * the existing check-in rather than starting a second session.
 *
 * @param {object} p
 * @param {'GEOFENCE'|'QR_PASS'|'MANUAL'} p.method
 */
async function performCheckIn({ booking, coords, method, distanceMeters, passId = null, actorId }) {
  if (booking.status === BOOKING_STATUS.ACTIVE) {
    return { alreadyCheckedIn: true, booking, checkIn: booking.checkIn };
  }

  if (!CHECKIN_FROM.includes(booking.status)) {
    throw ApiError.badRequest(
      booking.status === BOOKING_STATUS.PENDING_PAYMENT
        ? 'Pay for this booking before checking in'
        : `This booking is ${booking.status.toLowerCase().replace(/_/g, ' ')} and cannot be checked in`,
      ERROR_CODES.BOOKING_STATE_INVALID
    );
  }

  // Guard against checking in long before the slot opens. A 15-minute grace
  // covers early arrivals without letting someone claim a slot hours ahead.
  const EARLY_GRACE_MS = 15 * 60000;
  if (Date.now() < new Date(booking.startAt).getTime() - EARLY_GRACE_MS) {
    throw ApiError.badRequest(
      'Your booking has not started yet. You can check in from 15 minutes before your slot.',
      ERROR_CODES.BOOKING_STATE_INVALID
    );
  }
  if (Date.now() > new Date(booking.endAt).getTime()) {
    throw ApiError.badRequest('That booking window has already passed', ERROR_CODES.BOOKING_STATE_INVALID);
  }

  const session = await mongoose.startSession();
  let updated;

  try {
    await session.withTransaction(async () => {
      const fresh = await Booking.findById(booking._id).session(session);
      if (!fresh) throw ApiError.notFound('That booking no longer exists');

      // Re-check inside the transaction: a concurrent ping may have won.
      if (fresh.status === BOOKING_STATUS.ACTIVE) {
        updated = fresh;
        return;
      }

      fresh.checkIn = {
        at: new Date(),
        coordinates: coords ? [coords.lng, coords.lat] : undefined,
        distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
        method,
        passId,
      };
      fresh.transitionTo(BOOKING_STATUS.ACTIVE);
      await fresh.save({ session });

      updated = fresh;
    });
  } catch (err) {
    if (/Transaction numbers are only allowed on a replica set/i.test(err.message || '')) {
      throw new ApiError(
        500,
        'Check-in needs a MongoDB replica set. Point MONGO_URI at MongoDB Atlas (the free M0 tier is one).',
        ERROR_CODES.INTERNAL
      );
    }
    throw err;
  } finally {
    await session.endSession();
  }

  logger.info(`[geofence] booking ${booking._id} checked in via ${method} (${distanceMeters ?? '—'} m)`);

  // Notifications are deliberately outside the transaction: a push failure
  // must never roll back a successful check-in.
  const endsAt = new Date(updated.endAt);
  notify({
    userId: updated.driverId,
    type: NOTIFICATION_TYPE.BOOKING,
    title: 'Checked in',
    body: `Your session is active until ${endsAt.toLocaleTimeString('en-GB', {
      timeZone: PLATFORM.TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
    })}. Check out on time to avoid a penalty.`,
    deepLink: `/bookings/${updated._id}`,
    meta: { bookingId: String(updated._id), method },
  }).catch(() => {});

  notify({
    userId: updated.hostId,
    type: NOTIFICATION_TYPE.BOOKING,
    title: 'Driver has arrived',
    body: 'Your guest just checked in at the entrance.',
    deepLink: `/bookings/${updated._id}`,
    meta: { bookingId: String(updated._id) },
  }).catch(() => {});

  return { alreadyCheckedIn: false, booking: updated, checkIn: updated.checkIn };
}

/* ------------------------------------------------------------------------ */
/* Public operations                                                        */
/* ------------------------------------------------------------------------ */

/** Where the fence is, without evaluating a position. */
async function getTarget({ bookingId, userId, role }) {
  const { booking, property } = await loadBooking(bookingId, userId, role);
  const target = targetOf(property);

  return {
    bookingId: booking._id,
    status: booking.status,
    checkIn: booking.checkIn,
    radiusM: GEOFENCE_RADIUS_M,
    minAccuracyM: MIN_ACCURACY_M,
    allowMockLocation: ALLOW_MOCK_LOCATION,
    target: { lat: target.lat, lng: target.lng, instructions: target.instructions },
    property: { _id: property._id, title: property.title, propertyType: property.propertyType },
  };
}

/**
 * The background coordinate ping. The driver's device calls this every few
 * seconds; when the fence is breached the status flips automatically.
 */
async function ping({ bookingId, userId, role, coords }) {
  const { booking, property, isDriver } = await loadBooking(bookingId, userId, role);

  if (!isDriver && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only the driver on this booking can check in');
  }

  const target = targetOf(property);
  const proximity = evaluateProximity({ target, coords });

  if (booking.status === BOOKING_STATUS.ACTIVE) {
    return { ...proximity, status: booking.status, checkedIn: true, checkIn: booking.checkIn };
  }

  if (!proximity.canCheckIn) {
    return {
      ...proximity,
      status: booking.status,
      checkedIn: false,
      code: proximity.isInside ? null : ERROR_CODES.NOT_IN_GEOFENCE,
    };
  }

  const result = await performCheckIn({
    booking,
    coords,
    method: 'GEOFENCE',
    distanceMeters: proximity.distanceMeters,
    actorId: userId,
  });

  return {
    ...proximity,
    status: result.booking.status,
    checkedIn: true,
    checkIn: result.checkIn,
    justCheckedIn: !result.alreadyCheckedIn,
  };
}

/**
 * Manual check-in. Kept for two legitimate cases: underground parking with no
 * usable GPS, and a host confirming arrival on the driver's behalf. Both are
 * recorded with method MANUAL so an audit can tell them apart from a genuine
 * geofence trigger.
 */
async function manualCheckIn({ bookingId, userId, role, coords }) {
  const { booking, property, isDriver, isHost } = await loadBooking(bookingId, userId, role);
  if (!isDriver && !isHost && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You are not a party to this booking');
  }

  let distanceMeters = null;
  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    distanceMeters = Math.round(haversineMeters(coords, targetOf(property)));
  }

  const result = await performCheckIn({
    booking,
    coords,
    method: 'MANUAL',
    distanceMeters,
    actorId: userId,
  });

  return {
    bookingId: booking._id,
    status: result.booking.status,
    checkIn: result.checkIn,
    alreadyCheckedIn: result.alreadyCheckedIn,
  };
}

module.exports = {
  haversineMeters,
  evaluateProximity,
  targetOf,
  loadBooking,
  performCheckIn,
  getTarget,
  ping,
  manualCheckIn,
  GEOFENCE_RADIUS_M,
  MIN_ACCURACY_M,
};
