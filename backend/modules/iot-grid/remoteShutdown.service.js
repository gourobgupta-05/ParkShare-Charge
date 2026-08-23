/**
 * REMOTE SHUTDOWN — OWNER: Maidul Islam [MI]
 *
 * The IoT actor listens for a stop command. Either party can trigger it: the
 * driver ending a charge early, or the host cutting power to their own
 * charger. Both are legitimate, so the authorisation check allows either.
 */
const { Session, Booking } = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { SESSION_STATUS, ROLES } = require('../../shared/constants');
const simulator = require('./powerSimulator.worker');

async function requestShutdown({ sessionId, userId, role, reason = 'REMOTE_STOP' }) {
  const session = await Session.findById(sessionId);
  if (!session) throw ApiError.notFound('That charging session no longer exists');

  const booking = await Booking.findById(session.bookingId).select('driverId hostId').lean();
  if (!booking) throw ApiError.notFound('The booking for this session no longer exists');

  const isParty =
    String(booking.driverId) === String(userId) || String(booking.hostId) === String(userId);
  if (!isParty && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You are not a party to this charging session');
  }

  if (session.status === SESSION_STATUS.STOPPED) {
    return { sessionId: session._id, alreadyStopped: true, status: session.status };
  }

  await simulator.stop(session._id, { reason, status: SESSION_STATUS.STOPPED });
  await Session.updateOne({ _id: session._id }, { $set: { remoteShutdownAt: new Date() } });

  logger.info(`[iot] remote shutdown on session ${session._id} by ${userId} (${reason})`);
  return { sessionId: session._id, stopped: true, reason, status: SESSION_STATUS.STOPPED };
}

module.exports = { requestShutdown };
