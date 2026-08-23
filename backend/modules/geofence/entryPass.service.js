/**
 * DIGITAL ENTRY PASS — OWNER: S. Moontaha Rahman [SMR]
 *
 * The replacement for the cut OCR licence-plate feature. The driver's phone
 * renders a short-lived signed token as a QR code; the host scans it and the
 * server verifies the signature.
 *
 * Why this beats plate OCR: it authenticates the *booking*, not the car, it
 * expires, it cannot be forged without the server secret, and it works in a
 * basement where no camera would read a plate reliably anyway.
 *
 * Replay protection: the token is bound to the booking and carries a nonce
 * recorded on check-in, so a screenshot passed to a friend fails once used.
 */
const crypto = require('crypto');
const { signEntryPass, verifyEntryPass } = require('../../utils/token');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { BOOKING_STATUS, ERROR_CODES, ROLES } = require('../../shared/constants');
const { loadBooking, performCheckIn } = require('./geofence.service');

const TTL_MIN = Number(process.env.QR_PASS_TTL_MIN) || 15;

/** Issues a pass for the driver to display. */
async function issuePass({ bookingId, userId, role }) {
  const { booking, property, isDriver } = await loadBooking(bookingId, userId, role);

  if (!isDriver && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only the driver on this booking can generate an entry pass');
  }

  const issuable = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.EN_ROUTE, BOOKING_STATUS.ACTIVE];
  if (!issuable.includes(booking.status)) {
    throw ApiError.badRequest(
      'An entry pass is available once your booking is paid for',
      ERROR_CODES.BOOKING_STATE_INVALID
    );
  }

  const passId = crypto.randomBytes(9).toString('hex');
  const token = signEntryPass({
    bookingId: String(booking._id),
    driverId: String(booking.driverId),
    propertyId: String(booking.propertyId),
    passId,
  });

  return {
    token,
    passId,
    expiresInMinutes: TTL_MIN,
    expiresAt: new Date(Date.now() + TTL_MIN * 60000),
    booking: {
      _id: booking._id,
      startAt: booking.startAt,
      endAt: booking.endAt,
      status: booking.status,
    },
    property: { _id: property._id, title: property.title },
  };
}

/**
 * Host scans the QR. Verifies the signature, confirms the scanner owns the
 * space, and checks the driver in.
 */
async function verifyPass({ token, scannerId, role }) {
  if (!token || typeof token !== 'string') {
    throw ApiError.badRequest('Scan a valid entry pass', undefined, { token: 'Pass token is required' });
  }

  let payload;
  try {
    payload = verifyEntryPass(token);
  } catch (err) {
    throw ApiError.badRequest(
      err.name === 'TokenExpiredError'
        ? 'That pass has expired. Ask the driver to refresh it.'
        : 'That pass is not valid',
      ERROR_CODES.UNAUTHORIZED
    );
  }

  if (payload.kind !== 'entry_pass') {
    throw ApiError.badRequest('That is not an entry pass');
  }

  const { booking, property } = await loadBooking(payload.bookingId, scannerId, role);

  // The scanner must own the space the pass was issued for.
  const isHost = String(property.hostId) === String(scannerId);
  if (!isHost && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('This pass is not for one of your spaces');
  }
  if (String(payload.propertyId) !== String(property._id)) {
    throw ApiError.badRequest('That pass was issued for a different space');
  }

  // Replay guard — a pass already consumed cannot check anyone in again.
  if (booking.checkIn?.passId && booking.checkIn.passId !== payload.passId) {
    throw ApiError.conflict('This booking was already checked in with a different pass');
  }

  const result = await performCheckIn({
    booking,
    coords: null,
    method: 'QR_PASS',
    distanceMeters: null,
    passId: payload.passId,
    actorId: scannerId,
  });

  logger.info(`[geofence] pass ${payload.passId} accepted for booking ${booking._id}`);

  return {
    valid: true,
    alreadyCheckedIn: result.alreadyCheckedIn,
    bookingId: booking._id,
    status: result.booking.status,
    checkIn: result.checkIn,
    property: { _id: property._id, title: property.title },
    window: { startAt: booking.startAt, endAt: booking.endAt },
  };
}

module.exports = { issuePass, verifyPass, TTL_MIN };
