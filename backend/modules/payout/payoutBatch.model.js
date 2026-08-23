/**
 * PAYOUT BATCH — OWNER: S. Moontaha Rahman [SMR]
 * Feature-local model. One record per settlement, and one per withdrawal.
 *
 * SETTLEMENT rows are the audit trail of the 88/12 split. WITHDRAWAL rows
 * record a host moving their balance out to bKash or a bank — which, in this
 * project, is an internal ledger movement rather than a real disbursement,
 * because no student team can hold a payout licence.
 */
const mongoose = require('mongoose');

const payoutBatchSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['SETTLEMENT', 'WITHDRAWAL'], default: 'SETTLEMENT', index: true },

    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },

    grossPoisha: { type: Number, required: true, min: 0 },
    commissionRate: { type: Number, required: true },
    commissionPoisha: { type: Number, required: true, min: 0 },
    hostCreditPoisha: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ['SETTLED', 'REQUESTED', 'PAID', 'FAILED'],
      default: 'SETTLED',
      index: true,
    },
    payoutChannel: {
      type: { type: String, default: null },
      accountRef: { type: String, default: null }, // masked, never a full account number
    },

    settledAt: { type: Date, default: Date.now },
    note: { type: String, default: null },
  },
  { timestamps: true, collection: 'payout_batches' }
);

// One settlement per booking — the guard against paying a host twice.
payoutBatchSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { kind: 'SETTLEMENT' } }
);
payoutBatchSchema.index({ hostId: 1, createdAt: -1 });

module.exports = mongoose.models.PayoutBatch || mongoose.model('PayoutBatch', payoutBatchSchema);
