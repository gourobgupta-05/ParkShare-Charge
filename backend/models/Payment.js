/**
 * PAYMENT — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * One record per money movement attached to a booking. [TDN] creates it when
 * escrow is held; [SMR] updates the settlement block when funds are split.
 * The immutable audit trail lives in LedgerEntry, not here.
 */
const mongoose = require('mongoose');
const { PAYMENT_METHOD, ESCROW_STATUS } = require('../shared/constants');

const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    method: { type: String, enum: Object.values(PAYMENT_METHOD), default: PAYMENT_METHOD.WALLET },
    provider: { type: String, default: 'internal' },     // internal | sslcz | bkash | mock
    gatewayRef: { type: String, default: null },          // sandbox transaction id

    // Snapshot of the fare at the moment of charge — invoices must not change
    // if the host later edits their price.
    breakdown: {
      basePoisha: { type: Number, default: 0 },
      energyPoisha: { type: Number, default: 0 },
      discountPoisha: { type: Number, default: 0 },
      vatPoisha: { type: Number, default: 0 },
      processingFeePoisha: { type: Number, default: 0 },
    },
    amountPoisha: { type: Number, required: true, min: 0 },

    escrowStatus: { type: String, enum: Object.values(ESCROW_STATUS), default: ESCROW_STATUS.NONE, index: true },
    heldAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    refundedPoisha: { type: Number, default: 0, min: 0 },

    // [SMR] settlement result
    commissionPoisha: { type: Number, default: 0, min: 0 },
    hostCreditPoisha: { type: Number, default: 0, min: 0 },
    settledAt: { type: Date, default: null },

    failureReason: { type: String, default: null },
  },
  { timestamps: true, collection: 'payments' }
);

paymentSchema.index({ escrowStatus: 1, createdAt: -1 });

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
