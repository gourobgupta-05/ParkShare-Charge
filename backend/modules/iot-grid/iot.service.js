/**
 * IoT SERVICE — OWNER: Maidul Islam [MI]
 * Session lifecycle plus the history endpoints behind the charts.
 *
 * The shared Session model is used as-is — no schema is redefined here.
 * booking.sessionId is [MI]-owned, so linking the two is ours to write.
 */
const mongoose = require('mongoose');
const { Session, Booking, Property, User } = require('../../models');
const PowerReading = require('./powerReading.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { SESSION_STATUS, BOOKING_STATUS, ROLES, ERROR_CODES } = require('../../shared/constants');
const simulator = require('./powerSimulator.worker');

/** Loads a booking and checks the caller is on it. */
async function assertParty(bookingId, userId, role) {
  if (!mongoose.isValidObjectId(bookingId)) throw ApiError.badRequest('That is not a valid booking id');

  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('That booking no longer exists');

  const isParty =
    String(booking.driverId) === String(userId) || String(booking.hostId) === String(userId);
  if (!isParty && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You are not a party to this booking');
  }
  return booking;
}

/**
 * Opens a charging session and starts the broker.
 * Only ACTIVE bookings can charge — the driver must have checked in, which is
 * [SMR]'s geofence feature. Metering a booking nobody turned up to would put
 * fabricated kWh into the invoice.
 */
async function startSession({ bookingId, userId, role }) {
  const booking = await assertParty(bookingId, userId, role);

  if (booking.status !== BOOKING_STATUS.ACTIVE) {
    throw ApiError.badRequest(
      booking.status === BOOKING_STATUS.CONFIRMED || booking.status === BOOKING_STATUS.EN_ROUTE
        ? 'Check in at the space before starting a charge'
        : `This booking is ${booking.status.toLowerCase().replace(/_/g, ' ')} and cannot charge`,
      ERROR_CODES.BOOKING_STATE_INVALID
    );
  }

  const property = await Property.findById(booking.propertyId)
    .select('title hasCharger chargerSpec')
    .lean();
  if (!property?.hasCharger) {
    throw ApiError.badRequest('This space is parking only — there is no charger to start');
  }

  const driver = await User.findById(booking.driverId).select('ev').lean();

  let session = await Session.findOne({ bookingId: booking._id });
  if (!session) {
    session = await Session.create({
      bookingId: booking._id,
      propertyId: booking.propertyId,
      driverId: booking.driverId,
      status: SESSION_STATUS.CHARGING,
      startedAt: new Date(),
    });
    // booking.sessionId is an [MI]-owned field.
    await Booking.updateOne({ _id: booking._id }, { $set: { sessionId: session._id } });
  } else if (session.status === SESSION_STATUS.STOPPED) {
    throw ApiError.conflict('This charging session has already finished');
  } else {
    session.status = SESSION_STATUS.CHARGING;
    session.startedAt = session.startedAt || new Date();
    await session.save();
  }

  await simulator.start({
    sessionId: session._id,
    bookingId: booking._id,
    maxKw: property.chargerSpec?.kw,
    batteryKwh: driver?.ev?.batteryKwh,
  });

  logger.info(`[iot] session ${session._id} charging on ${property.title}`);
  return {
    session,
    chargerKw: property.chargerSpec?.kw || null,
    connectorType: property.chargerSpec?.connectorType || null,
    tickMs: simulator.TICK_MS,
  };
}

/** Pause without ending — the broker halts but the session stays open. */
async function pauseSession({ sessionId, userId, role }) {
  const session = await Session.findById(sessionId);
  if (!session) throw ApiError.notFound('That charging session no longer exists');
  await assertParty(session.bookingId, userId, role);

  if (session.status !== SESSION_STATUS.CHARGING) {
    throw ApiError.badRequest('That session is not currently charging');
  }

  await simulator.stop(session._id, { reason: 'PAUSED', status: SESSION_STATUS.PAUSED });
  return { sessionId: session._id, status: SESSION_STATUS.PAUSED };
}

async function getSession({ bookingId, userId, role }) {
  const booking = await assertParty(bookingId, userId, role);

  const session = await Session.findOne({ bookingId: booking._id }).lean();
  if (!session) {
    return { session: null, isRunning: false, message: 'No charge has been started for this booking' };
  }

  const latest = await PowerReading.findOne({ sessionId: session._id })
    .sort({ ts: -1 })
    .lean();

  return {
    session,
    latest,
    isRunning: simulator.isRunning(session._id),
    tickMs: simulator.TICK_MS,
  };
}

/** Recent readings for the chart, oldest first so the line draws correctly. */
async function getReadings({ bookingId, userId, role, limit = 120 }) {
  const booking = await assertParty(bookingId, userId, role);

  const session = await Session.findOne({ bookingId: booking._id }).select('_id').lean();
  if (!session) return { items: [], total: 0 };

  const capped = Math.min(Math.max(parseInt(limit, 10) || 120, 1), 500);
  const items = await PowerReading.find({ sessionId: session._id })
    .sort({ ts: -1 })
    .limit(capped)
    .lean();

  return { sessionId: session._id, items: items.reverse(), total: items.length };
}

/** Host-side energy log across every space they own. */
async function getHostEnergyLogs({ hostId, page = 1, limit = 20 }) {
  const properties = await Property.find({ hostId }).select('_id title').lean();
  const propertyIds = properties.map((p) => p._id);
  const titles = new Map(properties.map((p) => [String(p._id), p.title]));

  const match = { propertyId: { $in: propertyIds } };

  const [items, total, totals] = await Promise.all([
    Session.find(match)
      .sort({ startedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Session.countDocuments(match),
    Session.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalKwh: { $sum: '$totalKwh' },
          energyCostPoisha: { $sum: '$energyCostPoisha' },
          sessions: { $sum: 1 },
          peakKw: { $max: '$peakKw' },
        },
      },
    ]),
  ]);

  return {
    items: items.map((s) => ({ ...s, propertyTitle: titles.get(String(s.propertyId)) || null })),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
    totals: totals[0] || { totalKwh: 0, energyCostPoisha: 0, sessions: 0, peakKw: 0 },
  };
}

/** Diagnostic — which brokers are ticking right now. */
const brokerStatus = () => ({
  active: simulator.activeSessions(),
  tickMs: simulator.TICK_MS,
  isSimulated: true,
});

module.exports = {
  startSession,
  pauseSession,
  getSession,
  getReadings,
  getHostEnergyLogs,
  brokerStatus,
};
