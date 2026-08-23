/**
 * ESCROW SERVICE — OWNER: Tamal Deb Nath [TDN]
 * Read-side queries plus the release hook that [SMR]'s split-payout feature
 * calls when a session completes.
 */
const mongoose = require('mongoose');
const { Booking } = require('../../models');
const EscrowHold = require('./escrowHold.model');
const ApiError = require('../../utils/ApiError');
const { ESCROW_STATUS, ROLES } = require('../../shared/constants');

async function getHoldForBooking(bookingId, requesterId, role) {
  if (!mongoose.isValidObjectId(bookingId)) throw ApiError.badRequest('That is not a valid booking id');

  const hold = await EscrowHold.findOne({ bookingId })
    .populate('paymentId')
    .lean();
  if (!hold) throw ApiError.notFound('No escrow hold exists for this booking');

  const isParty =
    String(hold.driverId) === String(requesterId) || String(hold.hostId) === String(requesterId);
  if (!isParty && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You are not a party to this booking');
  }

  return hold;
}

async function listHolds({ status, page = 1, limit = 20 }) {
  const match = {};
  if (status) match.status = status;

  const [items, total] = await Promise.all([
    EscrowHold.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('driverId', 'name email')
      .populate('hostId', 'name email businessName')
      .lean(),
    EscrowHold.countDocuments(match),
  ]);

  const totals = await EscrowHold.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }, amountPoisha: { $sum: '$amountPoisha' } } },
  ]);

  return { items, page, limit, total, pages: Math.ceil(total / limit) || 1, byStatus: totals };
}

/** Bookings the driver still owes money on. */
async function listMyHolds(driverId) {
  return EscrowHold.find({ driverId }).sort({ createdAt: -1 }).limit(50).lean();
}

/**
 * INTEGRATION HOOK FOR [SMR] PAYOUT.
 *
 * Escrow owns the hold; the 88/12 split is Moontaha's transaction. Rather than
 * having two features write the same documents, payout calls this inside its
 * own session:
 *
 *   const { markReleased } = require('../escrow/escrow.service');
 *   await markReleased({ bookingId, session });
 *
 * It flips the hold and payment to RELEASED and stamps booking.escrow — all
 * [TDN]-owned fields — leaving the wallet/ledger split entirely to payout.
 */
async function markReleased({ bookingId, session = null }) {
  const query = EscrowHold.findOne({ bookingId });
  if (session) query.session(session);
  const hold = await query;

  if (!hold) throw ApiError.notFound('No escrow hold exists for this booking');
  if (hold.status === ESCROW_STATUS.RELEASED) return { alreadyReleased: true, hold };
  if (hold.status !== ESCROW_STATUS.HELD) {
    throw ApiError.conflict(`Cannot release funds that are ${hold.status.toLowerCase()}`);
  }

  hold.status = ESCROW_STATUS.RELEASED;
  hold.releasedAt = new Date();
  await hold.save({ session });

  const { Payment } = require('../../models');
  await Payment.updateOne(
    { _id: hold.paymentId },
    { $set: { escrowStatus: ESCROW_STATUS.RELEASED, releasedAt: hold.releasedAt } },
    { session }
  );

  await Booking.updateOne(
    { _id: bookingId },
    { $set: { 'escrow.status': ESCROW_STATUS.RELEASED, 'escrow.releasedAt': hold.releasedAt } },
    { session }
  );

  return { alreadyReleased: false, hold, amountPoisha: hold.amountPoisha };
}

module.exports = { getHoldForBooking, listHolds, listMyHolds, markReleased };
