/**
 * PROMO CODE — OWNER: Maidul Islam [MI]
 * Feature-local model. Commercial partner campaigns, e.g. JAMUNA20.
 *
 * The discount is a FLAT amount in poisha, not a percentage — mall partners
 * fund a fixed subsidy per booking, and a flat figure is what they can budget
 * against. maxDiscountPoisha still caps it against a cheap booking.
 */
const mongoose = require('mongoose');
const { PROPERTY_TYPE } = require('../../shared/constants');

const promoCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
    },
    partnerName: { type: String, trim: true, default: null }, // e.g. Jamuna Future Park
    description: { type: String, trim: true, maxlength: 200, default: '' },

    /** Flat discount applied to the pre-VAT subtotal. */
    discountPoisha: { type: Number, required: true, min: 1 },
    /** Never discount more than this, whatever the booking is worth. */
    maxDiscountPoisha: { type: Number, default: null },
    /** Booking must be at least this much before the code applies. */
    minSpendPoisha: { type: Number, default: 0, min: 0 },

    /* ------------------------------------------------------------ scope -- */
    /** null = any category. MALL restricts it to commercial partners. */
    propertyType: { type: String, enum: [...Object.values(PROPERTY_TYPE), null], default: null },
    /** Empty = every property in scope. Otherwise only these. */
    propertyIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Property', default: [] },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    /* ------------------------------------------------------------ limits -- */
    usageLimit: { type: Number, default: null },   // null = unlimited
    usedCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 1, min: 1 },

    validFrom: { type: Date, default: Date.now },
    validTo: { type: Date, default: null },        // null = no expiry
    isActive: { type: Boolean, default: true, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'promo_codes' }
);

promoCodeSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });
promoCodeSchema.index({ propertyType: 1, isActive: 1 });

/** Is the code live right now, ignoring booking-specific rules? */
promoCodeSchema.methods.isLive = function isLive(at = new Date()) {
  if (!this.isActive) return false;
  if (this.validFrom && at < this.validFrom) return false;
  if (this.validTo && at > this.validTo) return false;
  if (this.usageLimit !== null && this.usedCount >= this.usageLimit) return false;
  return true;
};

module.exports = mongoose.models.PromoCode || mongoose.model('PromoCode', promoCodeSchema);
