/**
 * MALL HOURS GUARD WORKER — OWNER: Tamal Deb Nath [TDN]
 *
 * The middleware blocks bad bookings at creation. This worker is the safety
 * net for bookings that became invalid afterwards — typically when a mall
 * manager shortens their opening hours while unpaid bookings already exist.
 *
 * It sweeps PENDING_PAYMENT bookings on mall properties and expires the ones
 * that now breach closing time. It never touches CONFIRMED bookings: once
 * money is in escrow, cancelling is a refund decision, not a sweep.
 *
 * Self-registering: required by mallHours.routes.js, which routes/index.js
 * already mounts — so no shared file needs editing to start it.
 * Disable with MALL_HOURS_WORKER_ENABLED=false.
 */
const { Booking, Property } = require('../../models');
const { BOOKING_STATUS, PROPERTY_TYPE } = require('../../shared/constants');
const logger = require('../../utils/logger');
const service = require('./mallHours.service');

let timer = null;

async function sweepOnce() {
  const now = new Date();

  const pending = await Booking.find({
    status: BOOKING_STATUS.PENDING_PAYMENT,
    endAt: { $gte: now },
  })
    .limit(200)
    .exec();

  if (!pending.length) return { scanned: 0, expired: 0 };

  const propertyIds = [...new Set(pending.map((b) => String(b.propertyId)))];
  const properties = await Property.find({
    _id: { $in: propertyIds },
    propertyType: PROPERTY_TYPE.MALL,
  })
    .select('title propertyType operatingHours')
    .lean();

  const byId = new Map(properties.map((p) => [String(p._id), p]));
  let expired = 0;

  for (const booking of pending) {
    const property = byId.get(String(booking.propertyId));
    if (!property) continue; // residential — not this guard's business

    const verdict = service.evaluateWindow(property, booking.startAt, booking.endAt);
    if (verdict.allowed) continue;

    try {
      booking.transitionTo(BOOKING_STATUS.EXPIRED);
      booking.mallHoursCheck = { passed: false, checkedAt: new Date(), reason: verdict.reason };
      booking.cancelledReason = verdict.reason;
      await booking.save();
      expired += 1;
    } catch (err) {
      logger.warn(`[mall-hours] could not expire booking ${booking._id}: ${err.message}`);
    }
  }

  if (expired) logger.info(`[mall-hours] expired ${expired} booking(s) breaching closing time`);
  return { scanned: pending.length, expired };
}

function startMallHoursWorker() {
  if (timer) return timer;
  if (process.env.MALL_HOURS_WORKER_ENABLED === 'false') {
    logger.info('[mall-hours] worker disabled by env');
    return null;
  }

  const intervalMs = Math.max(parseInt(process.env.MALL_HOURS_WORKER_INTERVAL_MS || '300000', 10), 30000);

  // Catch-up run on boot. Render's free tier sleeps, so a worker that assumes
  // it ticked continuously will silently miss everything. Sweeping on every
  // boot makes the schedule irrelevant.
  sweepOnce().catch((err) => logger.error(`[mall-hours] boot sweep failed: ${err.message}`));

  timer = setInterval(() => {
    sweepOnce().catch((err) => logger.error(`[mall-hours] sweep failed: ${err.message}`));
  }, intervalMs);

  if (timer.unref) timer.unref(); // never hold the process open
  logger.info(`[mall-hours] guard worker running every ${Math.round(intervalMs / 1000)}s`);
  return timer;
}

function stopMallHoursWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startMallHoursWorker, stopMallHoursWorker, sweepOnce };
