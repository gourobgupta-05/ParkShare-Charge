/**
 * ============================================================================
 * SPLIT PAYOUT SETTLEMENT — MongoDB ACID TRANSACTION #2 · OWNER: [SMR]
 * ============================================================================
 * Runs when a session completes. Six collections move together or none do:
 *
 *   escrow_holds     HELD → RELEASED           (via [TDN]'s markReleased hook)
 *   payments         escrowStatus + split figures
 *   wallets          driver escrow ↓ , host balance ↑
 *   users            host.balancePoisha ↑      (denormalised for the dashboard)
 *   ledger_entries   three immutable lines: release, host credit, commission
 *   payout_batches   the settlement record
 *   bookings         settlement block + escrow.status
 *
 * WHY THE COMMISSION IS A SEPARATE LEDGER LINE
 * "Host got 88%" is not an accounting record. Three lines — funds leaving
 * escrow, funds entering the host wallet, funds entering platform revenue —
 * mean the books balance and the 12% is auditable on its own. The invariant
 * commission + hostCredit === gross is asserted by utils/money.splitCommission
 * and re-checked here before anything is written.
 *
 * ⚠️ REQUIRES A REPLICA SET (MongoDB Atlas M0 is one).
 * ============================================================================
 */
const mongoose = require('mongoose');
const {
  Booking, Payment, Wallet, LedgerEntry, PlatformConfig, User,
} = require('../../models');
const PayoutBatch = require('./payoutBatch.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { splitCommission, formatPoisha } = require('../../utils/money');
const {
  BOOKING_STATUS, ESCROW_STATUS, LEDGER_TYPE, ERROR_CODES,
  NOTIFICATION_TYPE, PLATFORM,
} = require('../../shared/constants');
const { markReleased } = require('../escrow/escrow.service');
const { notify } = require('../penalty/notify.service');

const PLATFORM_ESCROW_ACCOUNT = 'escrow:platform';
const PLATFORM_REVENUE_ACCOUNT = 'revenue:platform';
const walletAccount = (userId) => `wallet:${userId}`;

/** Statuses from which a booking may be settled. */
const SETTLEABLE = [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.OVERSTAY];

/**
 * Settles one booking.
 *
 * Idempotent by construction: the unique index on payout_batches.bookingId
 * rejects a second SETTLEMENT row, so a retried worker or a double-tapped
 * button cannot pay a host twice.
 *
 * @param {object} p
 * @param {string} p.bookingId
 * @param {string} [p.actorId]
 * @param {string} [p.reason]
 */
async function settleBooking({ bookingId, actorId = null, reason = 'SESSION_COMPLETE' }) {
  if (!mongoose.isValidObjectId(bookingId)) throw ApiError.badRequest('That is not a valid booking id');

  /* ------------------------------------------------------- pre-checks --- */
  const existing = await PayoutBatch.findOne({ bookingId, kind: 'SETTLEMENT' }).lean();
  if (existing) {
    return { alreadySettled: true, batch: existing };
  }

  const booking = await Booking.findById(bookingId).lean();
  if (!booking) throw ApiError.notFound('That booking no longer exists');

  if (!SETTLEABLE.includes(booking.status)) {
    throw ApiError.badRequest(
      `A booking is settled once the session completes — this one is ${booking.status
        .toLowerCase()
        .replace(/_/g, ' ')}`,
      ERROR_CODES.BOOKING_STATE_INVALID
    );
  }

  if (booking.escrow?.status !== ESCROW_STATUS.HELD) {
    throw ApiError.badRequest(
      booking.escrow?.status === ESCROW_STATUS.RELEASED
        ? 'These funds have already been released'
        : 'There are no funds held in escrow for this booking',
      ERROR_CODES.BOOKING_STATE_INVALID
    );
  }

  const config = await PlatformConfig.current();
  const commissionRate = config?.commissionRate ?? PLATFORM.COMMISSION_RATE;

  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(
      async () => {
        /* ------------------------------------------ 1. release escrow --- */
        // [TDN] owns the hold; this is the hook they exposed for exactly this.
        const release = await markReleased({ bookingId: booking._id, session });
        const grossPoisha = release.amountPoisha ?? release.hold?.amountPoisha ?? booking.escrow.heldPoisha;

        if (!Number.isInteger(grossPoisha) || grossPoisha <= 0) {
          throw ApiError.badRequest('The held amount for this booking is invalid');
        }

        /* ------------------------------------------------- 2. the split -- */
        const { commissionPoisha, hostCreditPoisha } = splitCommission(grossPoisha, commissionRate);

        // Belt and braces: the helper asserts this, we re-check before writing.
        if (commissionPoisha + hostCreditPoisha !== grossPoisha) {
          throw new Error(`Split invariant broken on booking ${booking._id}`);
        }

        /* ------------------------------------------------ 3. driver side -- */
        // Funds leave the driver's escrow bucket. Their spendable balance was
        // already debited by [TDN] when the hold was placed.
        const driverWallet = await Wallet.findOne({ ownerId: booking.driverId }).session(session);
        if (driverWallet) {
          await Wallet.updateOne(
            { _id: driverWallet._id },
            {
              $inc: { escrowPoisha: -Math.min(grossPoisha, driverWallet.escrowPoisha) },
              $set: { lastMovementAt: new Date() },
            },
            { session }
          );
        }

        /* -------------------------------------------------- 4. host side -- */
        let hostWallet = await Wallet.findOne({ ownerId: booking.hostId }).session(session);
        if (!hostWallet) {
          [hostWallet] = await Wallet.create(
            [{ ownerId: booking.hostId, ownerRole: 'HOST', balancePoisha: 0 }],
            { session }
          );
        }

        await Wallet.updateOne(
          { _id: hostWallet._id },
          { $inc: { balancePoisha: hostCreditPoisha }, $set: { lastMovementAt: new Date() } },
          { session }
        );

        // Denormalised mirror the host dashboard reads.
        await User.updateOne(
          { _id: booking.hostId },
          { $inc: { balancePoisha: hostCreditPoisha } },
          { session }
        );

        /* ---------------------------------------------------- 5. ledger --- */
        await LedgerEntry.create(
          [
            {
              type: LEDGER_TYPE.ESCROW_RELEASE,
              refType: 'BOOKING',
              refId: booking._id,
              debitAccount: PLATFORM_ESCROW_ACCOUNT,
              creditAccount: 'clearing:settlement',
              amountPoisha: grossPoisha,
              userId: booking.driverId,
              note: 'Escrow released on session completion',
            },
            {
              type: LEDGER_TYPE.HOST_CREDIT,
              refType: 'BOOKING',
              refId: booking._id,
              debitAccount: 'clearing:settlement',
              creditAccount: walletAccount(booking.hostId),
              amountPoisha: hostCreditPoisha,
              balanceAfterPoisha: hostWallet.balancePoisha + hostCreditPoisha,
              userId: booking.hostId,
              note: `Host earnings at ${((1 - commissionRate) * 100).toFixed(0)}%`,
            },
            {
              type: LEDGER_TYPE.PLATFORM_COMMISSION,
              refType: 'BOOKING',
              refId: booking._id,
              debitAccount: 'clearing:settlement',
              creditAccount: PLATFORM_REVENUE_ACCOUNT,
              amountPoisha: commissionPoisha,
              userId: null,
              note: `Platform commission at ${(commissionRate * 100).toFixed(0)}%`,
            },
          ],
          { session, ordered: true }
        );

        /* ----------------------------------------------------- 6. batch --- */
        const [batch] = await PayoutBatch.create(
          [
            {
              kind: 'SETTLEMENT',
              hostId: booking.hostId,
              bookingId: booking._id,
              paymentId: booking.escrow?.paymentId || null,
              grossPoisha,
              commissionRate,
              commissionPoisha,
              hostCreditPoisha,
              status: 'SETTLED',
              settledAt: new Date(),
              note: reason,
            },
          ],
          { session }
        );

        /* --------------------------------------------------- 7. payment --- */
        if (booking.escrow?.paymentId) {
          await Payment.updateOne(
            { _id: booking.escrow.paymentId },
            {
              $set: {
                commissionPoisha,
                hostCreditPoisha,
                settledAt: new Date(),
                escrowStatus: ESCROW_STATUS.RELEASED,
              },
            },
            { session }
          );
        }

        /* --------------------------------------------------- 8. booking --- */
        // Only [SMR]-owned fields on the booking.
        await Booking.updateOne(
          { _id: booking._id },
          {
            $set: {
              'settlement.payoutBatchId': batch._id,
              'settlement.hostCreditPoisha': hostCreditPoisha,
              'settlement.commissionPoisha': commissionPoisha,
              'settlement.settledAt': new Date(),
            },
          },
          { session }
        );

        result = {
          alreadySettled: false,
          batch,
          grossPoisha,
          commissionPoisha,
          hostCreditPoisha,
          commissionRate,
        };
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 10000 }
    );
  } catch (err) {
    if (err.code === 11000) {
      const raced = await PayoutBatch.findOne({ bookingId, kind: 'SETTLEMENT' }).lean();
      if (raced) return { alreadySettled: true, batch: raced };
    }
    if (/Transaction numbers are only allowed on a replica set/i.test(err.message || '')) {
      throw new ApiError(
        500,
        'Settlement needs a MongoDB replica set. Point MONGO_URI at MongoDB Atlas (the free M0 tier is one).',
        ERROR_CODES.INTERNAL
      );
    }
    throw err;
  } finally {
    await session.endSession();
  }

  logger.info(
    `[payout] settled booking ${bookingId}: host ${formatPoisha(result.hostCreditPoisha)}, ` +
      `platform ${formatPoisha(result.commissionPoisha)}`
  );

  notify({
    userId: booking.hostId,
    type: NOTIFICATION_TYPE.PAYMENT,
    title: 'Earnings released',
    body: `${formatPoisha(result.hostCreditPoisha)} has been added to your balance.`,
    deepLink: '/host/earnings',
    meta: { bookingId: String(booking._id), batchId: String(result.batch._id) },
  }).catch(() => {});

  return result;
}

module.exports = {
  settleBooking,
  SETTLEABLE,
  PLATFORM_ESCROW_ACCOUNT,
  PLATFORM_REVENUE_ACCOUNT,
  walletAccount,
};
