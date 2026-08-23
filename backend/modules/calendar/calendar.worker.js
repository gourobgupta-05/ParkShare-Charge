/**
 * PENDING-BOOKING SWEEPER — OWNER: Gourob Gupta [GG]
 *
 * An unpaid booking holds slot locks. If the driver walks away from checkout,
 * those slots would stay unbookable forever. This expires PENDING_PAYMENT
 * bookings older than SLOT_LOCK_TTL_SECONDS and releases their locks.
 *
 * Self-registering: required by calendar.routes.js, which routes/index.js
 * already mounts, so no shared file needs editing to schedule it.
 * Sweeps on boot as well as on an interval, because Render's free tier sleeps
 * and an interval-only worker silently misses everything while asleep.
 *
 * Disable with CALENDAR_WORKER_ENABLED=false.
 */
const mongoose = require('mongoose');
const { Booking } = require('../../models');
const SlotLock = require('./slotLock.model');
const { BOOKING_STATUS, PLATFORM } = require('../../shared/constants');
const logger = require('../../utils/logger');

let timer = null;

async function sweepOnce() {
  const ttlSeconds = Number(process.env.SLOT_LOCK_TTL_SECONDS) || PLATFORM.SLOT_LOCK_TTL_SECONDS;
  const cutoff = new Date(Date.now() - ttlSeconds * 1000);

  const stale = await Booking.find({
    status: BOOKING_STATUS.PENDING_PAYMENT,
    createdAt: { $lt: cutoff },
  })
    .limit(200)
    .exec();

  if (!stale.length) return { scanned: 0, expired: 0 };

  let expired = 0;
  for (const booking of stale) {
    const session = await mongoose.startSession();
    try {
      // eslint-disable-next-line no-await-in-loop
      await session.withTransaction(async () => {
        booking.transitionTo(BOOKING_STATUS.EXPIRED);
        booking.cancelledReason = 'Payment was not completed in time';
        await booking.save({ session });
        await SlotLock.deleteMany({ bookingId: booking._id }, { session });
      });
      expired += 1;
    } catch (err) {
      logger.warn(`[calendar] could not expire booking ${booking._id}: ${err.message}`);
    } finally {
      // eslint-disable-next-line no-await-in-loop
      await session.endSession();
    }
  }

  if (expired) logger.info(`[calendar] expired ${expired} unpaid booking(s) and released their slots`);
  return { scanned: stale.length, expired };
}

function startCalendarWorker() {
  if (timer) return timer;
  if (process.env.CALENDAR_WORKER_ENABLED === 'false') {
    logger.info('[calendar] sweeper disabled by env');
    return null;
  }

  const intervalMs = Math.max(parseInt(process.env.CALENDAR_WORKER_INTERVAL_MS || '120000', 10), 30000);

  sweepOnce().catch((err) => logger.error(`[calendar] boot sweep failed: ${err.message}`));

  timer = setInterval(() => {
    sweepOnce().catch((err) => logger.error(`[calendar] sweep failed: ${err.message}`));
  }, intervalMs);

  if (timer.unref) timer.unref();
  logger.info(`[calendar] pending-booking sweeper running every ${Math.round(intervalMs / 1000)}s`);
  return timer;
}

function stopCalendarWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startCalendarWorker, stopCalendarWorker, sweepOnce };
