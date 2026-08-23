/**
 * INVOICE — OWNER: Gourob Gupta [GG]
 * Feature-local model. An invoice is an immutable historical record: it
 * snapshots the amounts at issue time so a later price change, refund or
 * tariff update can never rewrite a document the driver already downloaded.
 */
const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },

    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },

    issuedAt: { type: Date, default: Date.now },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },

    /** Frozen snapshot — never recomputed. All values integer poisha. */
    lines: [
      {
        _id: false,
        code: { type: String, required: true },   // PARKING | ENERGY | DISCOUNT | VAT | FEE
        description: { type: String, required: true },
        detail: { type: String, default: null },  // e.g. "13.33 kWh @ ৳13.90 (PEAK)"
        amountPoisha: { type: Number, required: true },
      },
    ],

    basePoisha: { type: Number, default: 0 },
    energyPoisha: { type: Number, default: 0 },
    discountPoisha: { type: Number, default: 0 },
    vatPoisha: { type: Number, default: 0 },
    processingFeePoisha: { type: Number, default: 0 },
    totalPoisha: { type: Number, required: true },

    vatRate: { type: Number, default: 0.15 },
    totalKwh: { type: Number, default: 0 },
    tariffVersion: { type: String, default: null },

    /** Denormalised so the PDF renders identically years later. */
    issuer: {
      name: { type: String, default: null },
      address: { type: String, default: null },
      bin: { type: String, default: null },
    },
    billedTo: {
      name: { type: String, default: null },
      email: { type: String, default: null },
      phone: { type: String, default: null },
    },
    propertySnapshot: {
      title: { type: String, default: null },
      address: { type: String, default: null },
      propertyType: { type: String, default: null },
      hostName: { type: String, default: null },
    },
  },
  { timestamps: true, collection: 'invoices' }
);

invoiceSchema.index({ issuedAt: -1 });

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
