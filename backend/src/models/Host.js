const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Host Model (Property Owner / Mall Manager)
 * Owner: Gourob Gupta — Module 1
 *
 * Covers what F1 (Driver-Side Post-Session Feedback & Verification Matrix)
 * needs: identity, property basics, and the rating aggregate fields that
 * get recalculated every time a new Feedback document is created.
 *
 * NOTE: Full host onboarding/verification (NID docs, legal paperwork,
 * charger capability metrics) is S. Moontaha Rahman's "Host Verification &
 * Garage Space Provisioning Pipeline" in Module 2 — this schema stays
 * intentionally lean and additive so her branch can extend it with
 * `Schema.add()` or new fields without conflicting with this one.
 */
const hostSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Host name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Host email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    phone: {
      type: String,
      required: [true, 'Host phone number is required'],
      trim: true,
    },
    propertyType: {
      type: String,
      enum: ['Residential', 'Mall'],
      required: [true, 'propertyType is required'],
    },
    propertyName: {
      type: String,
      required: [true, 'propertyName is required'],
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'address is required'],
      trim: true,
    },
    location: {
      // GeoJSON Point — enables 2dsphere / $geoNear queries used by
      // Tamal's Real-Time Interactive Geospatial Search Matrix.
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
    },

    // --- Rating aggregate fields (written by feedbackController) ---
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgReliability: { type: Number, default: 0 },
    avgSafety: { type: Number, default: 0 },
    avgEfficiency: { type: Number, default: 0 },
  },
  { timestamps: true }
);

hostSchema.index({ location: '2dsphere' });

module.exports = mongoose.models.Host || mongoose.model('Host', hostSchema);
