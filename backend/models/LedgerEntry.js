/**
 * LEDGER ENTRY — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * APPEND-ONLY. Never update, never delete. Every poisha that moves anywhere in
 * the platform leaves one of these behind. This is what makes the escrow [TDN]
 * and split-payout [SMR] features auditable — and what you show the examiner.
 */
const mongoose = require('mongoose');
const { LEDGER_TYPE } = require('../shared/constants');

const ledgerEntrySchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(LEDGER_TYPE), required: true, index: true },
    refType: { type: String, enum: ['BOOKING', 'PAYMENT', 'PAYOUT', 'PENALTY', 'TOPUP'], required: true },
    refId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    // Account labels, e.g. 'wallet:<userId>', 'escrow:platform', 'revenue:platform'
    debitAccount: { type: String, required: true },
    creditAccount: { type: String, required: true },

    amountPoisha: { type: Number, required: true, min: 0 },
    balanceAfterPoisha: { type: Number, default: null },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    note: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'ledger_entries' }
);

// Guard the append-only rule at the model level.
ledgerEntrySchema.pre('findOneAndUpdate', function block(next) {
  next(new Error('LedgerEntry is append-only — write a reversing entry instead'));
});
ledgerEntrySchema.pre('updateOne', function block(next) {
  next(new Error('LedgerEntry is append-only — write a reversing entry instead'));
});

ledgerEntrySchema.index({ createdAt: -1 });

module.exports = mongoose.models.LedgerEntry || mongoose.model('LedgerEntry', ledgerEntrySchema);
