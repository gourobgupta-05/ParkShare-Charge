/**
 * IoT SOCKET NAMESPACE (/iot) — OWNER: Maidul Islam [MI]
 *
 * Registered once by realtime/index.js, which authenticates every handshake
 * with the same JWT as the REST API. Clients join a room per session, so a
 * driver only ever receives telemetry for their own charge.
 */
const { Session, Booking } = require('../../models');
const logger = require('../../utils/logger');
const { SOCKET_EVENTS, ROLES } = require('../../shared/constants');
const simulator = require('./powerSimulator.worker');
const { requestShutdown } = require('./remoteShutdown.service');

let namespaceRef = null;

/** Confirms the socket's user is on the booking behind this session. */
async function canAccessSession(socket, sessionId) {
  const session = await Session.findById(sessionId).select('bookingId').lean();
  if (!session) return false;

  const booking = await Booking.findById(session.bookingId).select('driverId hostId').lean();
  if (!booking) return false;

  return (
    String(booking.driverId) === String(socket.userId) ||
    String(booking.hostId) === String(socket.userId) ||
    socket.role === ROLES.ADMIN
  );
}

module.exports = function registerIotNamespace(nsp) {
  namespaceRef = nsp;
  simulator.bindNamespace(nsp);

  // Pick up any session left mid-charge by a restart or a Render sleep.
  simulator.resumeOnBoot();

  nsp.on('connection', (socket) => {
    logger.debug(`[iot] connected: ${socket.id} (user ${socket.userId})`);

    socket.on(SOCKET_EVENTS.IOT_SUBSCRIBE, async ({ sessionId } = {}, ack) => {
      try {
        if (!sessionId) throw new Error('sessionId is required');
        if (!(await canAccessSession(socket, sessionId))) {
          throw new Error('You are not a party to this charging session');
        }

        socket.join(`session:${sessionId}`);
        const running = simulator.isRunning(sessionId);
        if (typeof ack === 'function') ack({ ok: true, sessionId, running });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('iot:unsubscribe', ({ sessionId } = {}) => {
      if (sessionId) socket.leave(`session:${sessionId}`);
    });

    socket.on(SOCKET_EVENTS.IOT_SHUTDOWN, async ({ sessionId, reason } = {}, ack) => {
      try {
        const result = await requestShutdown({
          sessionId,
          userId: socket.userId,
          role: socket.role,
          reason: reason || 'REMOTE_STOP',
        });
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('disconnect', () => logger.debug(`[iot] disconnected: ${socket.id}`));
  });
};

/** Lets REST controllers push into the namespace without importing socket.io. */
module.exports.getIotNamespace = () => namespaceRef;
