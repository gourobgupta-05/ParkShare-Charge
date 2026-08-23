/**
 * ============================================================================
 * DELAYED CHECKOUT PENALTY — OWNER: S. Moontaha Rahman [SMR]
 * ============================================================================
 * Drivers who overstay block the next booking, so the penalty is not punitive
 * for its own sake — it is the only lever that keeps the slot schedule honest.
 *
 * This module is the sole writer of ACTIVE → COMPLETED and ACTIVE → OVERSTAY.
 *
 * ACCRUAL IS COMPUTED, NOT TICKED
 * The amount owed is always derived from elapsed time, never incremented on a
 * timer. That matters because Render's free tier sleeps: a worker that adds
 * ৳5 per tick would under-charge by exactly as long as the server was asleep.
 * Deriving it means a sweep that runs late produces the same number as one
 * that ran on schedule.
 * ============================================================================
 */
const mongoose = require('mongoose');
const { Booking, Wallet, LedgerEntry, User, PlatformConfig } = require('../../models');
const Penalty = require('./penalty.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { formatPoisha } = require('../../utils/money');
const {
  BOOKING_STATUS, PENALTY_STATUS, LEDGER_TYPE, PLATFORM,
  NOTIFICATION_TYPE, ERROR_CODES, ROLES,
} = require('../../shared/constants');
const { notify } = require('./notify.service');
const { lockAccount, unlockIfClear } = require('./accountLock.service');

const GRACE_MINUTES = Number(process.env.PENALTY_GRACE_MINUTES) || PLATFORM.CHECKOUT_GRACE_MINUTES;
const RATE = Number(process.env.PENALTY_RATE_POISHA_PER_MIN) || PLATFORM.PENALTY_RATE_POISHA_PER_MIN;
const CAP = Number(process.env.PENALTY_MAX_POISHA) || PLATFORM.PENALTY_MAX_POISHA;

/* ------------------------------------------------------------------------ */
/* Accrual maths (pure)                                                     */
/* ------------------------------------------------------------------------ */

/** When the penalty clock starts: booked end plus the grace period. */
const dueAtFor = (endAt) => new Date(new Date(endAt).getTime() + GRACE_MINUTES * 60000);

/**
 * @returns {{lateMinutes:number, accruedPoisha:number, isLate:boolean, cappedOut:boolean}}
 */
function computeAccrual({ endAt, at = new Date(), ratePoishaPerMin = RATE, capPoisha = CAP }) {
  const due = dueAtFor(endAt);
  const overMs = new Date(at).getTime() - due.getTime();

  if (overMs <= 0) {
    return { lateMinutes: 0, accruedPoisha: 0, isLate: false, cappedOut: false, dueAt: due };
  }

  const lateMinutes = Math.ceil(overMs / 60000);
  const raw = lateMinutes * ratePoishaPerMin;
  const accruedPoisha = Math.min(raw, capPoisha);

  return { lateMinutes, accruedPoisha, isLate: true, cappedOut: raw > capPoisha, dueAt: due };
}

/* ------------------------------------------------------------------------ */
/* Checkout                                                                 */
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
  return { booking, isDriver, isHost };
}

/**
 * Ends the session. Computes lateness, records any penalty, flips the booking
 * to COMPLETED, then triggers settlement so the host is paid.
 *
 * Settlement runs after the transaction commits rather than inside it: it is
 * its own multi-document transaction, and nesting them would abort both if the
 * payout hit a transient conflict. A failed settlement is retryable from
 * /api/payout/settle/:bookingId; a failed checkout would strand the driver.
 */
async function checkout({ bookingId, userId, role, at = new Date() }) {
  const { booking } = await loadBooking(bookingId, userId, role);

  if (booking.status === BOOKING_STATUS.COMPLETED) {
    return { alreadyCheckedOut: true, booking, penalty: null };
  }
  if (![BOOKING_STATUS.ACTIVE, BOOKING_STATUS.OVERSTAY].includes(booking.status)) {
    throw ApiError.badRequest(
      `You can only check out of an active session — this booking is ${booking.status
        .toLowerCase()
        .replace(/_/g, ' ')}`,
      ERROR_CODES.BOOKING_STATE_INVALID
    );
  }

  const config = await PlatformConfig.current();
  const rate = config?.penaltyRatePoishaPerMin ?? RATE;
  const accrual = computeAccrual({ endAt: booking.endAt, at, ratePoishaPerMin: rate });

  const session = await mongoose.startSession();
  let penaltyDoc = null;
  let updated;

  try {
    await session.withTransaction(async () => {
      const fresh = await Booking.findById(booking._id).session(session);
      if (fresh.status === BOOKING_STATUS.COMPLETED) {
        updated = fresh;
        return;
      }

      if (accrual.isLate) {
        penaltyDoc = await Penalty.findOne({ bookingId: fresh._id }).session(session);
        if (!penaltyDoc) {
          [penaltyDoc] = await Penalty.create(
            [
              {
                bookingId: fresh._id,
                driverId: fresh.driverId,
                hostId: fresh.hostId,
                status: PENALTY_STATUS.ACCRUING,
                dueAt: accrual.dueAt,
                lateMinutes: accrual.lateMinutes,
                ratePoishaPerMin: rate,
                accruedPoisha: accrual.accruedPoisha,
                capPoisha: CAP,
                lastAccruedAt: at,
              },
            ],
            { session }
          );
        } else {
          penaltyDoc.lateMinutes = accrual.lateMinutes;
          penaltyDoc.accruedPoisha = accrual.accruedPoisha;
          penaltyDoc.lastAccruedAt = at;
          await penaltyDoc.save({ session });
        }

        await User.updateOne(
          { _id: fresh.driverId },
          { $set: { outstandingPenaltyPoisha: accrual.accruedPoisha } },
          { session }
        );
      }

      fresh.checkOut = {
        at,
        isLate: accrual.isLate,
        lateMinutes: accrual.lateMinutes,
        penaltyId: penaltyDoc?._id || null,
      };
      fresh.transitionTo(BOOKING_STATUS.COMPLETED);
      await fresh.save({ session });

      updated = fresh;
    });
  } catch (err) {
    if (/Transaction numbers are only allowed on a replica set/i.test(err.message || '')) {
      throw new ApiError(
        500,
        'Checkout needs a MongoDB replica set. Point MONGO_URI at MongoDB Atlas (the free M0 tier is one).',
        ERROR_CODES.INTERNAL
      );
    }
    throw err;
  } finally {
    await session.endSession();
  }

  // Lock the account only if money is actually owed.
  if (penaltyDoc && penaltyDoc.accruedPoisha > 0) {
    await lockAccount({ driverId: updated.driverId, penalty: penaltyDoc });
    await Penalty.updateOne(
      { _id: penaltyDoc._id },
      { $set: { lockedAccount: true, lockedAt: new Date() } }
    );
  }

  /* ------------------------------------------------ trigger settlement -- */
  let settlement = null;
  try {
    // Required lazily to avoid a load-order cycle between the two modules.
    const { settleBooking } = require('../payout/settlement.transaction');
    settlement = await settleBooking({ bookingId: updated._id, actorId: userId, reason: 'CHECKOUT' });
  } catch (err) {
    // A settlement failure must not fail the checkout — it is retryable.
    logger.warn(`[penalty] settlement deferred for booking ${updated._id}: ${err.message}`);
  }

  notify({
    userId: updated.driverId,
    type: NOTIFICATION_TYPE.BOOKING,
    title: accrual.isLate ? 'Checked out late' : 'Checked out',
    body: accrual.isLate
      ? `You were ${accrual.lateMinutes} min over. A penalty of ${formatPoisha(accrual.accruedPoisha)} applies.`
      : 'Thanks — your session is complete. Leave a review?',
    deepLink: `/bookings/${updated._id}`,
  }).catch(() => {});

  logger.info(
    `[penalty] booking ${updated._id} checked out${accrual.isLate ? ` ${accrual.lateMinutes} min late` : ' on time'}`
  );

  return {
    alreadyCheckedOut: false,
    booking: updated,
    penalty: penaltyDoc,
    accrual,
    settlement,
  };
}

/* ------------------------------------------------------------------------ */
/* Reads                                                                    */
/* ------------------------------------------------------------------------ */

/** Live countdown data for the session screen. */
async function getStatus({ bookingId, userId, role }) {
  const { booking } = await loadBooking(bookingId, userId, role);
  const accrual = computeAccrual({ endAt: booking.endAt });
  const penalty = await Penalty.findOne({ bookingId: booking._id }).lean();

  const msRemaining = accrual.dueAt.getTime() - Date.now();

  return {
    bookingId: booking._id,
    status: booking.status,
    endAt: booking.endAt,
    dueAt: accrual.dueAt,
    graceMinutes: GRACE_MINUTES,
    ratePoishaPerMin: penalty?.ratePoishaPerMin ?? RATE,
    capPoisha: CAP,
    secondsRemaining: Math.max(Math.round(msRemaining / 1000), 0),
    isLate: accrual.isLate,
    lateMinutes: accrual.lateMinutes,
    accruedPoisha: penalty?.accruedPoisha ?? accrual.accruedPoisha,
    cappedOut: accrual.cappedOut,
    penalty,
    checkOut: booking.checkOut,
  };
}

async function listMine({ driverId }) {
  const items = await Penalty.find({ driverId }).sort({ createdAt: -1 }).limit(30).lean();
  const outstanding = items
    .filter((p) => p.status === PENALTY_STATUS.ACCRUING)
    .reduce((sum, p) => sum + p.accruedPoisha, 0);

  return { items, outstandingPoisha: outstanding, count: items.length };
}

/* ------------------------------------------------------------------------ */
/* Settling a penalty                                                       */
/* ------------------------------------------------------------------------ */

/**
 * Pays the penalty from the driver's wallet and unlocks the account.
 * A locked driver can still reach this route — auth only blocks booking
 * creation — which is what makes the lock escapable rather than a dead end.
 */
async function payPenalty({ penaltyId, driverId, role }) {
  if (!mongoose.isValidObjectId(penaltyId)) throw ApiError.badRequest('That is not a valid penalty id');

  const penalty = await Penalty.findById(penaltyId);
  if (!penalty) throw ApiError.notFound('That penalty no longer exists');
  if (String(penalty.driverId) !== String(driverId) && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You can only settle your own penalty');
  }
  if (penalty.status !== PENALTY_STATUS.ACCRUING) {
    return { alreadySettled: true, penalty };
  }

  const amount = penalty.accruedPoisha;
  if (amount <= 0) {
    penalty.status = PENALTY_STATUS.SETTLED;
    penalty.settledAt = new Date();
    await penalty.save();
    await unlockIfClear({ driverId: penalty.driverId });
    return { alreadySettled: false, penalty, chargedPoisha: 0 };
  }

  const wallet = await Wallet.findOne({ ownerId: penalty.driverId });
  if (!wallet) throw ApiError.badRequest('Your wallet has not been set up yet');
  if (wallet.balancePoisha < amount) {
    throw ApiError.badRequest(
      `Add ${formatPoisha(amount - wallet.balancePoisha)} to your wallet to clear this penalty`,
      ERROR_CODES.INSUFFICIENT_WALLET_BALANCE,
      { requiredPoisha: amount, balancePoisha: wallet.balancePoisha }
    );
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const debited = await Wallet.updateOne(
        { _id: wallet._id, balancePoisha: { $gte: amount } },
        { $inc: { balancePoisha: -amount }, $set: { lastMovementAt: new Date() } },
        { session }
      );
      if (debited.modifiedCount !== 1) {
        throw ApiError.conflict('Your balance changed mid-payment. Try again.');
      }

      await LedgerEntry.create(
        [
          {
            type: LEDGER_TYPE.PENALTY_DEBIT,
            refType: 'PENALTY',
            refId: penalty._id,
            debitAccount: `wallet:${penalty.driverId}`,
            creditAccount: 'revenue:platform',
            amountPoisha: amount,
            balanceAfterPoisha: wallet.balancePoisha - amount,
            userId: penalty.driverId,
            note: `Overstay penalty, ${penalty.lateMinutes} min late`,
          },
        ],
        { session }
      );

      penalty.status = PENALTY_STATUS.SETTLED;
      penalty.settledPoisha = amount;
      penalty.settledAt = new Date();
      penalty.unlockedAt = new Date();
      await penalty.save({ session });

      await User.updateOne(
        { _id: penalty.driverId },
        { $set: { outstandingPenaltyPoisha: 0 } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  const unlock = await unlockIfClear({ driverId: penalty.driverId });

  logger.info(`[penalty] ${penaltyId} settled for ${formatPoisha(amount)}`);
  return { alreadySettled: false, penalty, chargedPoisha: amount, unlock };
}

/** Admin mercy — waives the amount and unlocks. */
async function waivePenalty({ penaltyId, adminId, reason }) {
  if (!mongoose.isValidObjectId(penaltyId)) throw ApiError.badRequest('That is not a valid penalty id');

  const text = String(reason || '').trim();
  if (text.length < 5) {
    throw ApiError.badRequest('Give a reason for the waiver', undefined, {
      reason: 'At least 5 characters',
    });
  }

  const penalty = await Penalty.findById(penaltyId);
  if (!penalty) throw ApiError.notFound('That penalty no longer exists');
  if (penalty.status !== PENALTY_STATUS.ACCRUING) return { penalty, alreadyClosed: true };

  penalty.status = PENALTY_STATUS.WAIVED;
  penalty.waivedBy = adminId;
  penalty.waivedReason = text.slice(0, 300);
  penalty.settledAt = new Date();
  penalty.unlockedAt = new Date();
  await penalty.save();

  await User.updateOne({ _id: penalty.driverId }, { $set: { outstandingPenaltyPoisha: 0 } });
  const unlock = await unlockIfClear({ driverId: penalty.driverId });

  notify({
    userId: penalty.driverId,
    type: NOTIFICATION_TYPE.PENALTY,
    title: 'Penalty waived',
    body: 'Your overstay penalty has been cancelled.',
    deepLink: '/bookings',
  }).catch(() => {});

  return { penalty, alreadyClosed: false, unlock };
}

async function listAll({ status, page = 1, limit = 20 }) {
  const match = status ? { status } : {};
  const [items, total] = await Promise.all([
    Penalty.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('driverId', 'name email accountState')
      .lean(),
    Penalty.countDocuments(match),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) || 1 };
}

module.exports = {
  computeAccrual,
  dueAtFor,
  checkout,
  getStatus,
  listMine,
  payPenalty,
  waivePenalty,
  listAll,
  GRACE_MINUTES,
  RATE,
  CAP,
};
