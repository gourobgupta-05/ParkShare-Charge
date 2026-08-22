/**
 * ESCROW REFUND / DISPUTE SERVICE — OWNER: Tamal Deb Nath [TDN]
 * The reverse of escrowHold.transaction.js, and equally atomic.
 * Used for driver cancellations and admin dispute resolution.
 *
 * The ledger is append-only, so a refund never edits the original entry — it
 * appends a reversing one. That is what makes the audit trail defensible.
 */
const mongoose = require('mongoose');
const { Booking, Wallet, Payment, LedgerEntry } = require('../../models');
const EscrowHold = require('./escrowHold.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { formatPoisha } = require('../../utils/money');
const {
  BOOKING_STATUS, ESCROW_STATUS, LEDGER_TYPE, ERROR_CODES,
} = require('../../shared/constants');
const { PLATFORM_ESCROW_ACCOUNT, walletAccount } = require('./escrowHold.transaction');

/**
 * Refunds a held amount back to the driver's wallet.
 * @param {object} p
 * @param {string} p.bookingId
 * @param {string} p.actorId          - who triggered it
 * @param {boolean} p.isAdmin
 * @param {number} [p.amountPoisha]   - partial refund; defaults to the full hold
 * @param {string} [p.reason]
 * @param {string} [p.nextStatus]     - BOOKING_STATUS.CANCELLED (default) or DISPUTED
 */
async function refund({ bookingId, actorId, isAdmin = false, amountPoisha, reason, nextStatus }) {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) throw ApiError.notFound('That booking no longer exists');

      if (!isAdmin && String(booking.driverId) !== String(actorId)) {
        throw ApiError.forbidden('You can only cancel your own bookings');
      }

      const hold = await EscrowHold.findOne({ bookingId: booking._id }).session(session);
      if (!hold) throw ApiError.badRequest('No escrow hold exists for this booking');

      if (hold.status === ESCROW_STATUS.REFUNDED) {
        throw ApiError.conflict('This booking has already been refunded');
      }
      if (hold.status === ESCROW_STATUS.RELEASED) {
        throw ApiError.conflict(
          'These funds were already settled to the host. Open a dispute instead.',
          ERROR_CODES.BOOKING_STATE_INVALID
        );
      }

      const remaining = hold.amountPoisha - hold.refundedPoisha;
      const refundPoisha = Number.isInteger(amountPoisha) && amountPoisha > 0
        ? Math.min(amountPoisha, remaining)
        : remaining;

      if (refundPoisha <= 0) throw ApiError.badRequest('There is nothing left to refund');

      // Drivers may only self-cancel before the session starts.
      if (!isAdmin && booking.status === BOOKING_STATUS.ACTIVE) {
        throw ApiError.badRequest('This session has already started. Contact support to dispute it.');
      }

      const wallet = await Wallet.findOne({ ownerId: booking.driverId }).session(session);
      if (!wallet) throw ApiError.badRequest('The driver wallet could not be found');

      await Wallet.updateOne(
        { _id: wallet._id },
        {
          $inc: { balancePoisha: refundPoisha, escrowPoisha: -refundPoisha },
          $set: { lastMovementAt: new Date() },
        },
        { session }
      );

      const isPartial = refundPoisha < remaining;
      hold.refundedPoisha += refundPoisha;
      hold.refundedAt = new Date();
      hold.refundReason = reason || 'Booking cancelled';
      hold.status = isPartial ? ESCROW_STATUS.PARTIAL_REFUND : ESCROW_STATUS.REFUNDED;
      await hold.save({ session });

      await Payment.updateOne(
        { _id: hold.paymentId },
        {
          $inc: { refundedPoisha: refundPoisha },
          $set: {
            escrowStatus: hold.status,
            failureReason: reason || null,
          },
        },
        { session }
      );

      // Reversing entry — the original ESCROW_HOLD line is never modified.
      await LedgerEntry.create(
        [
          {
            type: LEDGER_TYPE.REFUND,
            refType: 'BOOKING',
            refId: booking._id,
            debitAccount: PLATFORM_ESCROW_ACCOUNT,
            creditAccount: walletAccount(booking.driverId),
            amountPoisha: refundPoisha,
            balanceAfterPoisha: wallet.balancePoisha + refundPoisha,
            userId: booking.driverId,
            note: reason || 'Escrow refund',
          },
        ],
        { session }
      );

      booking.escrow = {
        ...booking.escrow,
        status: hold.status,
        heldPoisha: Math.max((booking.escrow?.heldPoisha || 0) - refundPoisha, 0),
      };
      booking.cancelledReason = reason || 'Booking cancelled';

      const target = nextStatus || BOOKING_STATUS.CANCELLED;
      if (booking.status !== target) {
        try {
          booking.transitionTo(target);
        } catch (err) {
          // A refund on a COMPLETED booking is legitimate; leave status alone
          // rather than forcing an illegal transition.
          logger.warn(`[escrow] refund kept booking ${booking._id} at ${booking.status}: ${err.message}`);
        }
      }
      await booking.save({ session });

      result = {
        bookingId: booking._id,
        refundedPoisha: refundPoisha,
        totalRefundedPoisha: hold.refundedPoisha,
        escrowStatus: hold.status,
        bookingStatus: booking.status,
        walletBalancePoisha: wallet.balancePoisha + refundPoisha,
      };
    });
  } finally {
    await session.endSession();
  }

  logger.info(`[escrow] refunded ${formatPoisha(result.refundedPoisha)} on booking ${result.bookingId}`);
  return result;
}

/** Flags a booking as disputed without moving money yet. */
async function openDispute({ bookingId, actorId, reason }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('That booking no longer exists');
  if (String(booking.driverId) !== String(actorId) && String(booking.hostId) !== String(actorId)) {
    throw ApiError.forbidden('Only the driver or host on this booking can dispute it');
  }
  if (!reason || String(reason).trim().length < 10) {
    throw ApiError.badRequest('Tell us what went wrong', undefined, {
      reason: 'Please describe the problem in at least 10 characters',
    });
  }

  booking.transitionTo(BOOKING_STATUS.DISPUTED);
  booking.cancelledReason = String(reason).trim().slice(0, 500);
  await booking.save();

  return { bookingId: booking._id, status: booking.status, reason: booking.cancelledReason };
}

module.exports = { refund, openDispute };
