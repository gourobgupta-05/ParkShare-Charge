/**
 * PENALTY — OWNER: S. Moontaha Rahman [SMR]
 * Feature-local model. One row per overstay, accruing while the driver
 * remains parked past their booked window.
 */
const mongoose = require('mongoose');
const { PENALTY_STATUS } = require('../../shared/constants');

const penaltySchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    status: { type: String, enum: Object.values(PENALTY_STATUS), default: PENALTY_STATUS.ACCRUING, index: true },

    dueAt: { type: Date, required: true },        // booking end + grace
    lateMinutes: { type: Number, default: 0, min: 0 },
    ratePoishaPerMin: { type: Number, required: true },
    accruedPoisha: { type: Number, default: 0, min: 0 },
    capPoisha: { type: Number, required: true },
    lastAccruedAt: { type: Date, default: null },

    /** Account lock is the enforcement, so it is recorded here too. */
    lockedAccount: { type: Boolean, default: false },
    lockedAt: { type: Date, default: null },
    unlockedAt: { type: Date, default: null },

    alertsSent: { type: Number, default: 0 },
    lastAlertAt: { type: Date, default: null },

    settledPoisha: { type: Number, default: 0, min: 0 },
    settledAt: { type: Date, default: null },
    waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    waivedReason: { type: String, default: null },
  },
  { timestamps: true, collection: 'penalties' }
);

penaltySchema.index({ status: 1, dueAt: 1 });

module.exports = mongoose.models.Penalty || mongoose.model('Penalty', penaltySchema);
