/**
 * SESSION (charging session) — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * One record per charging session. [MI] writes live telemetry into it,
 * [GG] reads kWh for the tariff + invoice, [SMR] reads totals for payout.
 */
const mongoose = require('mongoose');
const { SESSION_STATUS, TARIFF_PERIOD } = require('../shared/constants');

const sessionSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    status: { type: String, enum: Object.values(SESSION_STATUS), default: SESSION_STATUS.IDLE, index: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    lastReadingAt: { type: Date, default: null },

    // [MI] simulator writes these
    totalKwh: { type: Number, default: 0, min: 0 },
    peakKw: { type: Number, default: 0, min: 0 },
    avgVoltage: { type: Number, default: 0 },
    faultCode: { type: String, default: null },

    // [GG] tariff calculator writes these
    kwhByPeriod: {
      [TARIFF_PERIOD.OFF_PEAK]: { type: Number, default: 0 },
      [TARIFF_PERIOD.STANDARD]: { type: Number, default: 0 },
      [TARIFF_PERIOD.PEAK]: { type: Number, default: 0 },
    },
    energyCostPoisha: { type: Number, default: 0, min: 0 },
    tariffBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },

    remoteShutdownAt: { type: Date, default: null }, // [MI]
  },
  { timestamps: true, collection: 'sessions' }
);

sessionSchema.index({ status: 1, lastReadingAt: -1 });

module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema);
