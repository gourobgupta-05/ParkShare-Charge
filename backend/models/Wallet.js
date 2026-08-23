/**
 * WALLET — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * Internal balance in POISHA. Never write `balancePoisha` outside a Mongoose
 * transaction, and always append a matching LedgerEntry in the same session.
 */
const mongoose = require('mongoose');
const { ROLES } = require('../shared/constants');

const walletSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    ownerRole: { type: String, enum: Object.values(ROLES), required: true },
    balancePoisha: { type: Number, default: 0, min: 0 },
    escrowPoisha: { type: Number, default: 0, min: 0 }, // driver funds currently held
    currency: { type: String, default: 'BDT' },
    lastMovementAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'wallets' }
);

module.exports = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);
