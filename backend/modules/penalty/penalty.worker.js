/**
 * ============================================================================
 * PENALTY & PUSH ALERT WORKER — OWNER: S. Moontaha Rahman [SMR]
 * ============================================================================
 * The timed listener. Every sweep it:
 *   1. warns drivers whose window is about to close
 *   2. flips ACTIVE → OVERSTAY once the grace period lapses
 *   3. recomputes the accrued amount and locks the account
 *   4. sends the Firebase push (or the mock, if unconfigured)
 *
 * ⚠️ THE RENDER SLEEP PROBLEM — and why this design survives it
 * Render's free tier suspends the service after ~15 minutes idle, so a naive
 * `setInterval` simply stops. Two things make that survivable:
 *
 *   a) CATCH-UP ON BOOT. The sweep runs immediately at startup and scans every
 *      booking that is now overdue, rather than assuming it ticked continuously.
 *   b) DERIVED AMOUNTS. Penalties are computed from elapsed time, never
 *      incremented per tick, so a sweep that runs an hour late produces exactly
 *      the same figure as one that ran on time.
 *
 * Pair with an UptimeRobot ping on /api/health every 10 minutes and the worker
 * behaves. Disable entirely with PENALTY_WORKER_ENABLED=false.
 * ============================================================================
 */
const { Booking } = require('../../models');
const Penalty = require('./penalty.model');
const logger = require('../../utils/logger');
const { formatPoisha } = require('../../utils/money');
const {
  BOOKING_STATUS, PENALTY_STATUS, NOTIFICATION_TYPE, PLATFORM,
} = require('../../shared/constants');
const { notify } = require('./notify.service');
const { lockAccount } = require('./accountLock.service');
const { computeAccrual, dueAtFor, GRACE_MINUTES, RATE, CAP } = require('./penalty.service');

let timer = null;

/** Minutes before the window closes at which the warning fires. */
const WARN_BEFORE_MIN = Number(process.env.PENALTY_WARN_BEFORE_MINUTES) || 10;
/** Don't re-alert more often than this. */
const ALERT_COOLDOWN_MS = 15 * 60000;
const MAX_ALERTS = 4;

/* ------------------------------------------------------------------------ */
/* Pass 1 — approaching the end of the window                               */
/* ------------------------------------------------------------------------ */
async function warnUpcoming(now) {
  const windowEnd = new Date(now.getTime() + WARN_BEFORE_MIN * 60000);

  const soon = await Booking.find({
    status: BOOKING_STATUS.ACTIVE,
    endAt: { $gt: now, $lte: windowEnd },
  })
    .select('driverId endAt propertyId')
    .limit(100)
    .lean();

  let warned = 0;
  for (const booking of soon) {
    // One warning per booking: a Penalty row acts as the "already handled" flag,
    // so only bookings with no row yet get a nudge.
    // eslint-disable-next-line no-await-in-loop
    const exists = await Penalty.findOne({ bookingId: booking._id }).select('_id').lean();
    if (exists) continue;

    const minutesLeft = Math.max(Math.round((new Date(booking.endAt) - now) / 60000), 1);
    // eslint-disable-next-line no-await-in-loop
    await notify({
      userId: booking.driverId,
      type: NOTIFICATION_TYPE.PENALTY,
      title: `${minutesLeft} min left`,
      body: `Check out within ${minutesLeft + GRACE_MINUTES} min to avoid a ${formatPoisha(RATE)}/min penalty.`,
      deepLink: `/bookings/${booking._id}`,
      meta: { bookingId: String(booking._id), kind: 'ENDING_SOON' },
    }).catch(() => {});
    warned += 1;
  }

  return warned;
}

/* ------------------------------------------------------------------------ */
/* Pass 2 — overdue                                                         */
/* ------------------------------------------------------------------------ */
async function processOverdue(now) {
  // Anything still ACTIVE whose grace period has lapsed.
  const cutoff = new Date(now.getTime() - GRACE_MINUTES * 60000);

  const overdue = await Booking.find({
    status: { $in: [BOOKING_STATUS.ACTIVE, BOOKING_STATUS.OVERSTAY] },
    endAt: { $lte: cutoff },
  })
    .limit(200)
    .exec();

  let flipped = 0;
  let alerted = 0;

  for (const booking of overdue) {
    const accrual = computeAccrual({ endAt: booking.endAt, at: now });
    if (!accrual.isLate) continue;

    try {
      /* ---------------------------------------- status: ACTIVE -> OVERSTAY */
      if (booking.status === BOOKING_STATUS.ACTIVE) {
        booking.transitionTo(BOOKING_STATUS.OVERSTAY);
        await booking.save();
        flipped += 1;
      }

      /* ------------------------------------------- create or update accrual */
      let penalty = await Penalty.findOne({ bookingId: booking._id });
      if (!penalty) {
        penalty = await Penalty.create({
          bookingId: booking._id,
          driverId: booking.driverId,
          hostId: booking.hostId,
          status: PENALTY_STATUS.ACCRUING,
          dueAt: dueAtFor(booking.endAt),
          lateMinutes: accrual.lateMinutes,
          ratePoishaPerMin: RATE,
          accruedPoisha: accrual.accruedPoisha,
          capPoisha: CAP,
          lastAccruedAt: now,
        });
      } else if (penalty.status === PENALTY_STATUS.ACCRUING) {
        // Recomputed, never incremented — correct even after a long sleep.
        penalty.lateMinutes = accrual.lateMinutes;
        penalty.accruedPoisha = accrual.accruedPoisha;
        penalty.lastAccruedAt = now;
        await penalty.save();
      } else {
        continue; // already settled or waived
      }

      /* ------------------------------------------------------- lock account */
      if (!penalty.lockedAccount && penalty.accruedPoisha > 0) {
        await lockAccount({ driverId: booking.driverId, penalty });
        penalty.lockedAccount = true;
        penalty.lockedAt = now;
        await penalty.save();
      }

      /* -------------------------------------------------------- push alert */
      const cooledDown =
        !penalty.lastAlertAt || now.getTime() - new Date(penalty.lastAlertAt).getTime() > ALERT_COOLDOWN_MS;

      if (cooledDown && penalty.alertsSent < MAX_ALERTS) {
        await notify({
          userId: booking.driverId,
          type: NOTIFICATION_TYPE.PENALTY,
          title: 'You are over your booked time',
          body:
            `${accrual.lateMinutes} min over. ${formatPoisha(penalty.accruedPoisha)} owed` +
            `${accrual.cappedOut ? ' (capped)' : `, rising ${formatPoisha(RATE)}/min`}. Check out now.`,
          deepLink: `/bookings/${booking._id}`,
          meta: { bookingId: String(booking._id), penaltyId: String(penalty._id), kind: 'OVERSTAY' },
        }).catch(() => {});

        // Tell the host too — their next guest may be waiting at the gate.
        if (penalty.alertsSent === 0) {
          await notify({
            userId: booking.hostId,
            type: NOTIFICATION_TYPE.PENALTY,
            title: 'A driver is overstaying',
            body: 'The current session has run past its booked window.',
            deepLink: `/bookings/${booking._id}`,
          }).catch(() => {});
        }

        penalty.alertsSent += 1;
        penalty.lastAlertAt = now;
        await penalty.save();
        alerted += 1;
      }
    } catch (err) {
      logger.warn(`[penalty] could not process booking ${booking._id}: ${err.message}`);
    }
  }

  return { scanned: overdue.length, flipped, alerted };
}

/** One full sweep. Exported so admins can trigger it and tests can call it. */
async function sweepOnce() {
  const now = new Date();
  const [warned, overdue] = await Promise.all([warnUpcoming(now), processOverdue(now)]);

  if (overdue.flipped || overdue.alerted || warned) {
    logger.info(
      `[penalty] sweep — ${warned} warned, ${overdue.flipped} moved to overstay, ${overdue.alerted} alerted`
    );
  }

  return { at: now, warned, ...overdue };
}

function startPenaltyWorker() {
  if (timer) return timer;
  if (process.env.PENALTY_WORKER_ENABLED === 'false') {
    logger.info('[penalty] worker disabled by env');
    return null;
  }

  const intervalMs = Math.max(parseInt(process.env.PENALTY_WORKER_INTERVAL_MS || '60000', 10), 15000);

  // Catch-up sweep on boot — the whole reason this survives Render sleeping.
  sweepOnce().catch((err) => logger.error(`[penalty] boot sweep failed: ${err.message}`));

  timer = setInterval(() => {
    sweepOnce().catch((err) => logger.error(`[penalty] sweep failed: ${err.message}`));
  }, intervalMs);

  if (timer.unref) timer.unref();
  logger.info(
    `[penalty] worker running every ${Math.round(intervalMs / 1000)}s ` +
      `(grace ${GRACE_MINUTES} min, ${formatPoisha(RATE)}/min, cap ${formatPoisha(CAP)})`
  );
  return timer;
}

function stopPenaltyWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startPenaltyWorker, stopPenaltyWorker, sweepOnce, warnUpcoming, processOverdue };
