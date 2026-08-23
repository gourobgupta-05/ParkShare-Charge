/**
 * BERC RATE — OWNER: Gourob Gupta [GG]
 * Feature-local model. Stores a versioned set of time-of-use slabs so a
 * historical invoice can always be recomputed against the rates that were in
 * force on the day, even after the admin publishes a new version.
 */
const mongoose = require('mongoose');
const { TARIFF_PERIOD } = require('../../shared/constants');

const slabSchema = new mongoose.Schema(
  {
    period: { type: String, enum: Object.values(TARIFF_PERIOD), required: true },
    /** Asia/Dhaka local hours, end-exclusive. 17 -> 23 means 17:00 up to 22:59. */
    startHour: { type: Number, min: 0, max: 23, required: true },
    endHour: { type: Number, min: 1, max: 24, required: true },
    poishaPerKwh: { type: Number, min: 0, required: true },
    label: { type: String, default: null },
  },
  { _id: false }
);

const bercRateSchema = new mongoose.Schema(
  {
    version: { type: String, required: true, unique: true },
    authority: { type: String, default: 'Bangladesh Energy Regulatory Commission' },
    slabs: { type: [slabSchema], required: true },
    effectiveFrom: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: false, index: true },
    note: { type: String, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'berc_rates' }
);

bercRateSchema.index({ effectiveFrom: -1 });

module.exports = mongoose.models.BercRate || mongoose.model('BercRate', bercRateSchema);
