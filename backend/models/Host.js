/**
 * HOST — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * Discriminator of User. Residential owner OR commercial mall manager.
 *
 * ⚠️ `location` carries a 2dsphere index so [TDN] geospatial search can query
 * hosts directly. Property.location is ALSO 2dsphere-indexed — search normally
 * runs against Property (a host may list several), but both are ready.
 */
const mongoose = require('mongoose');
const User = require('./User');
const { ROLES, PROPERTY_TYPE, VERIFICATION_STATUS } = require('../shared/constants');

const hostSchema = new mongoose.Schema({
  propertyType: {
    type: String,
    enum: Object.values(PROPERTY_TYPE),
    required: [true, 'Choose Residential or Commercial Mall'],
  },
  businessName: { type: String, trim: true, default: null }, // malls only

  address: {
    line1: { type: String, trim: true, required: true },
    area: { type: String, trim: true, default: null },   // e.g. Dhanmondi
    city: { type: String, trim: true, default: 'Dhaka' },
    postcode: { type: String, trim: true, default: null },
  },

  // GeoJSON Point — ALWAYS [longitude, latitude]. Not [lat, lng]. This is the
  // single most common bug in geospatial work; get it wrong and Dhaka lands
  // in the Indian Ocean.
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (c) => Array.isArray(c) && c.length === 2 && c[0] >= -180 && c[0] <= 180 && c[1] >= -90 && c[1] <= 90,
        message: 'coordinates must be [longitude, latitude]',
      },
    },
  },

  // [SMR] host verification pipeline
  verificationStatus: {
    type: String,
    enum: Object.values(VERIFICATION_STATUS),
    default: VERIFICATION_STATUS.DRAFT,
  },
  verifiedAt: { type: Date, default: null },

  // [SMR] payout settlement
  payoutChannel: {
    type: { type: String, enum: ['BKASH', 'BANK', 'NAGAD', null], default: null },
    accountRef: { type: String, trim: true, default: null }, // masked, never full account no
  },
  balancePoisha: { type: Number, default: 0, min: 0 },

  // [GG] reviews — moving average maintained by the review service
  avgRating: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0, min: 0 },
});

hostSchema.index({ location: '2dsphere' });                 // ← geospatial search
hostSchema.index({ propertyType: 1, verificationStatus: 1 });

module.exports = User.discriminators?.[ROLES.HOST] || User.discriminator(ROLES.HOST, hostSchema);
