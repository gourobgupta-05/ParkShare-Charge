/**
 * ESCROW HOLD — OWNER: Tamal Deb Nath [TDN]
 * Feature-local model (allowed: it is used only by this feature).
 * The shared Payment / Wallet / LedgerEntry models are NOT redefined here.
 *
 * One hold per booking. Records the tokenized gateway reference and the exact
 * amount locked, so a refund never has to recompute a price.
 */
const mongoose = require('mongoose');
const { ESCROW_STATUS, PAYMENT_METHOD } = require('../../shared/constants');

const escrowHoldSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    amountPoisha: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(ESCROW_STATUS),
      default: ESCROW_STATUS.HELD,
      index: true,
    },

    method: { type: String, enum: Object.values(PAYMENT_METHOD), default: PAYMENT_METHOD.WALLET },
    gateway: { type: String, default: 'internal' },
    /** Tokenized reference — never a card or wallet number. */
    gatewayToken: { type: String, default: null },

    heldAt: { type: Date, default: Date.now },
    releasedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    refundedPoisha: { type: Number, default: 0, min: 0 },
    refundReason: { type: String, default: null },

    breakdown: {
      basePoisha: { type: Number, default: 0 },
      energyPoisha: { type: Number, default: 0 },
      discountPoisha: { type: Number, default: 0 },
      vatPoisha: { type: Number, default: 0 },
      processingFeePoisha: { type: Number, default: 0 },
    },
  },
  { timestamps: true, collection: 'escrow_holds' }
);

escrowHoldSchema.index({ status: 1, heldAt: -1 });

module.exports = mongoose.models.EscrowHold || mongoose.model('EscrowHold', escrowHoldSchema);
