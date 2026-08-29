/**
 * ============================================================================
 * ESCROW HOLD — MongoDB ACID TRANSACTION #1  ·  OWNER: Tamal Deb Nath [TDN]
 * ============================================================================
 * Locks a driver's funds when a booking is confirmed. Five collections move
 * together or none of them do:
 *
 *   wallets        driver balance ↓, escrow held ↑
 *   payments       a Payment record is created
 *   escrow_holds   an EscrowHold record is created
 *   ledger_entries an immutable double-entry line is appended
 *   bookings       escrow block written + status → CONFIRMED
 *
 * ⚠️ REQUIRES A REPLICA SET. MongoDB Atlas M0 is one; a local standalone
 *    mongod is not and will throw "Transaction numbers are only allowed on a
 *    replica set member". config/db.js warns about this at boot.
 *
 * Money is always an integer in poisha. Every arithmetic step goes through
 * utils/money.js so the ledger can never drift by a rounding error.
 * ============================================================================
 */
const mongoose = require('mongoose');
const { Booking, Property, Wallet, Payment, LedgerEntry, PlatformConfig } = require('../../models');
const EscrowHold = require('./escrowHold.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { percentOf, formatPoisha } = require('../../utils/money');
const {
  BOOKING_STATUS, ESCROW_STATUS, LEDGER_TYPE,
  PAYMENT_METHOD, ERROR_CODES, PLATFORM,
} = require('../../shared/constants');
const mallHours = require('../mall-hours/mallHours.service');

const PLATFORM_ESCROW_ACCOUNT = 'escrow:platform';
const walletAccount = (userId) => `wallet:${userId}`;

/**
 * Works out what to charge.
 *
 * [GG]'s tariff engine writes `booking.pricing`. Until that lands, this falls
 * back to computing from the property's hourly rate so escrow is independently
 * demoable. Once tariff merges, the stored pricing wins automatically — no
 * change needed here.
 */
async function resolveAmount(booking, property, config) {
  const stored = booking.pricing || {};
  if (stored.totalPoisha > 0) {
    return {
      basePoisha: stored.basePoisha || 0,
      energyPoisha: stored.energyPoisha || 0,
      discountPoisha: stored.discountPoisha || 0,
      vatPoisha: stored.vatPoisha || 0,
      processingFeePoisha: stored.processingFeePoisha || 0,
      totalPoisha: stored.totalPoisha,
      source: 'tariff-engine',
    };
  }

  const minutes = Math.max(Math.round((booking.endAt - booking.startAt) / 60000), 1);
  const basePoisha = Math.ceil((property.pricePerHourPoisha * minutes) / 60);
  const discountPoisha = Math.min(booking.promo?.discountPoisha || 0, basePoisha);
  const net = Math.max(basePoisha - discountPoisha, 0);
  const vatPoisha = percentOf(net, config.vatRate ?? PLATFORM.VAT_RATE);
  const processingFeePoisha = percentOf(net, PLATFORM.PROCESSING_FEE_RATE);

  return {
    basePoisha,
    energyPoisha: 0, // charging cost is metered after the session by [GG]
    discountPoisha,
    vatPoisha,
    processingFeePoisha,
    totalPoisha: net + vatPoisha + processingFeePoisha,
    source: 'escrow-fallback',
  };
}

/**
 * @param {object} params
 * @param {string} params.bookingId
 * @param {string} params.driverId   - from req.userId, never from the body
 * @param {string} [params.method]   - PAYMENT_METHOD
 * @param {string} [params.gatewayToken] - tokenized instrument reference
 */
async function holdFunds({ bookingId, driverId, method = PAYMENT_METHOD.WALLET, gatewayToken = null }) {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(
      async () => {
        /* ---------------------------------------------------- 1. load --- */
        const booking = await Booking.findById(bookingId).session(session);
        if (!booking) throw ApiError.notFound('That booking no longer exists');

        if (String(booking.driverId) !== String(driverId)) {
          throw ApiError.forbidden('You can only pay for your own bookings');
        }

        if (booking.escrow?.status === ESCROW_STATUS.HELD) {
          // Idempotency: a double-tap on "Pay" must not double-charge.
          throw ApiError.conflict('This booking is already paid', ERROR_CODES.BOOKING_STATE_INVALID);
        }

        if (booking.status !== BOOKING_STATUS.PENDING_PAYMENT) {
          throw ApiError.conflict(
            `This booking is ${booking.status.toLowerCase().replace(/_/g, ' ')} and cannot be paid for`,
            ERROR_CODES.BOOKING_STATE_INVALID
          );
        }

        if (booking.endAt <= new Date()) {
          throw ApiError.badRequest('That booking window has already passed');
        }

        const property = await Property.findById(booking.propertyId).session(session);
        if (!property) throw ApiError.notFound('That space no longer exists');

        /* ------------------------------- 2. mall opening-hours guard ---- */
        // Re-checked inside the transaction: the host may have shortened their
        // hours between booking creation and payment.
        const verdict = mallHours.evaluateWindow(property, booking.startAt, booking.endAt);
        if (!verdict.allowed) {
          throw ApiError.badRequest(verdict.reason, ERROR_CODES.OUTSIDE_MALL_HOURS, {
            operatingHours: verdict.hours,
          });
        }

        /* ------------------------------------------------- 3. amount ---- */
        const config = await PlatformConfig.current();
        const breakdown = await resolveAmount(booking, property, config);
        const amountPoisha = breakdown.totalPoisha;

        if (!Number.isInteger(amountPoisha) || amountPoisha <= 0) {
          throw ApiError.badRequest('Could not work out the fare for this booking');
        }

        /* -------------------------------------------------- 4. wallet --- */
        const wallet = await Wallet.findOne({ ownerId: driverId }).session(session);
        if (!wallet) throw ApiError.badRequest('Your wallet has not been set up yet');

        if (wallet.balancePoisha < amountPoisha) {
          const shortfall = amountPoisha - wallet.balancePoisha;
          throw ApiError.badRequest(
            `Add ${formatPoisha(shortfall)} to your wallet to confirm this booking`,
            ERROR_CODES.INSUFFICIENT_WALLET_BALANCE,
            {
              requiredPoisha: amountPoisha,
              balancePoisha: wallet.balancePoisha,
              shortfallPoisha: shortfall,
            }
          );
        }

        // Guarded update: the filter re-asserts the balance, so two concurrent
        // holds cannot both pass the check above and overdraw the wallet.
        const walletUpdate = await Wallet.updateOne(
          { _id: wallet._id, balancePoisha: { $gte: amountPoisha } },
          {
            $inc: { balancePoisha: -amountPoisha, escrowPoisha: amountPoisha },
            $set: { lastMovementAt: new Date() },
          },
          { session }
        );
        if (walletUpdate.modifiedCount !== 1) {
          throw ApiError.conflict('Your wallet balance changed mid-payment. Try again.');
        }

        /* ------------------------------------------------- 5. payment --- */
        const [payment] = await Payment.create(
          [
            {
              bookingId: booking._id,
              driverId,
              hostId: booking.hostId,
              method,
              provider: 'internal',
              gatewayRef: gatewayToken,
              breakdown: {
                basePoisha: breakdown.basePoisha,
                energyPoisha: breakdown.energyPoisha,
                discountPoisha: breakdown.discountPoisha,
                vatPoisha: breakdown.vatPoisha,
                processingFeePoisha: breakdown.processingFeePoisha,
              },
              amountPoisha,
              escrowStatus: ESCROW_STATUS.HELD,
              heldAt: new Date(),
            },
          ],
          { session }
        );

        /* ---------------------------------------------------- 6. hold --- */
        const [hold] = await EscrowHold.create(
          [
            {
              bookingId: booking._id,
              paymentId: payment._id,
              driverId,
              hostId: booking.hostId,
              amountPoisha,
              status: ESCROW_STATUS.HELD,
              method,
              gateway: process.env.PAYMENT_PROVIDER || 'mock',
              gatewayToken,
              heldAt: new Date(),
              breakdown: payment.breakdown,
            },
          ],
          { session }
        );

        /* -------------------------------------------------- 7. ledger --- */
        await LedgerEntry.create(
          [
            {
              type: LEDGER_TYPE.ESCROW_HOLD,
              refType: 'BOOKING',
              refId: booking._id,
              debitAccount: walletAccount(driverId),
              creditAccount: PLATFORM_ESCROW_ACCOUNT,
              amountPoisha,
              balanceAfterPoisha: wallet.balancePoisha - amountPoisha,
              userId: driverId,
              note: `Escrow hold for ${property.title}`,
            },
          ],
          { session }
        );

        /* ------------------------------------------------- 8. booking --- */
        // Only [TDN]-owned fields are written here (escrow, mallHoursCheck)
        // plus the status transition this feature is the declared writer of.
        booking.escrow = {
          paymentId: payment._id,
          status: ESCROW_STATUS.HELD,
          heldPoisha: amountPoisha,
          heldAt: new Date(),
          releasedAt: null,
        };
        booking.mallHoursCheck = { passed: true, checkedAt: new Date(), reason: null };
        if (breakdown.source === 'escrow-fallback') {
          booking.pricing = { ...booking.pricing, ...breakdown, estimatedKwh: booking.pricing?.estimatedKwh || 0 };
        }
        booking.transitionTo(BOOKING_STATUS.CONFIRMED);
        await booking.save({ session });

        result = {
          bookingId: booking._id,
          holdId: hold._id,
          paymentId: payment._id,
          amountPoisha,
          breakdown,
          status: ESCROW_STATUS.HELD,
          walletBalancePoisha: wallet.balancePoisha - amountPoisha,
          bookingStatus: booking.status,
        };
      },
      {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        maxCommitTimeMS: 10000,
      }
    );
  } catch (err) {
    if (/Transaction numbers are only allowed on a replica set/i.test(err.message || '')) {
      throw new ApiError(
        500,
        'Escrow needs a MongoDB replica set. Point MONGO_URI at MongoDB Atlas (the free M0 tier is a replica set).',
        ERROR_CODES.INTERNAL
      );
    }
    throw err;
  } finally {
    await session.endSession();
  }

  logger.info(`[escrow] held ${formatPoisha(result.amountPoisha)} for booking ${result.bookingId}`);
  return result;
}

module.exports = { holdFunds, resolveAmount, PLATFORM_ESCROW_ACCOUNT, walletAccount };
