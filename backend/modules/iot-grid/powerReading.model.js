/**
 * POWER READING — OWNER: Maidul Islam [MI]
 * Feature-local model. One document per simulated meter tick.
 *
 * Readings are high-volume and disposable once the session is costed, so a TTL
 * index expires them automatically. The durable totals live on the shared
 * Session document, which is what [GG]'s tariff engine and the invoice read.
 */
const mongoose = require('mongoose');

const powerReadingSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },

    ts: { type: Date, default: Date.now },
    voltage: { type: Number, required: true },      // volts
    current: { type: Number, required: true },      // amps
    kw: { type: Number, required: true },           // instantaneous power
    cumulativeKwh: { type: Number, required: true },// energy so far this session
    temperatureC: { type: Number, default: null },
    faultCode: { type: String, default: null },

    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, collection: 'power_readings' }
);

powerReadingSchema.index({ sessionId: 1, ts: -1 });
powerReadingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.PowerReading || mongoose.model('PowerReading', powerReadingSchema);
