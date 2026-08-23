/**
 * PROMO REDEMPTION — OWNER: Maidul Islam [MI]
 * One row per (code, booking). The unique index is what actually enforces
 * "one use per booking" — a counter alone would drift under concurrency.
 */
const mongoose = require('mongoose');

const promoRedemptionSchema = new mongoose.Schema(
  {
    promoId: { type: mongoose.Schema.Types.ObjectId, ref: 'PromoCode', required: true, index: true },
    code: { type: String, required: true, uppercase: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    discountPoisha: { type: Number, required: true, min: 0 },
    releasedAt: { type: Date, default: null }, // set when the code is removed
  },
  { timestamps: true, collection: 'promo_redemptions' }
);

promoRedemptionSchema.index({ promoId: 1, bookingId: 1 }, { unique: true });
promoRedemptionSchema.index({ promoId: 1, driverId: 1 });

module.exports =
  mongoose.models.PromoRedemption || mongoose.model('PromoRedemption', promoRedemptionSchema);
