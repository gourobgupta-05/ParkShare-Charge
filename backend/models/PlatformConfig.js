/**
 * PLATFORM CONFIG — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * Singleton document holding admin-tunable values. Defaults come from
 * shared/constants.js; the admin screens ([SMR] commission, [GG] tariff
 * multiplier) write here so nothing is hardcoded in the UI.
 */
const mongoose = require('mongoose');
const { PLATFORM } = require('../shared/constants');

const platformConfigSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'SINGLETON', unique: true },
    commissionRate: { type: Number, default: PLATFORM.COMMISSION_RATE, min: 0, max: 0.5 },
    vatRate: { type: Number, default: PLATFORM.VAT_RATE, min: 0, max: 0.5 },
    tariffMultiplier: { type: Number, default: 1, min: 0.1, max: 5 },
    penaltyRatePoishaPerMin: { type: Number, default: PLATFORM.PENALTY_RATE_POISHA_PER_MIN, min: 0 },
    checkoutGraceMinutes: { type: Number, default: PLATFORM.CHECKOUT_GRACE_MINUTES, min: 0 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'platform_config' }
);

/** Always use this — creates the singleton on first call. */
platformConfigSchema.statics.current = async function current() {
  return this.findOneAndUpdate(
    { key: 'SINGLETON' },
    { $setOnInsert: { key: 'SINGLETON' } },
    { new: true, upsert: true }
  );
};

module.exports = mongoose.models.PlatformConfig || mongoose.model('PlatformConfig', platformConfigSchema);
