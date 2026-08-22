/**
 * ============================================================================
 * PROPERTY — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * ============================================================================
 * A listed parking space (a residential garage slot or a mall basement bay).
 *
 * FIELD OWNERSHIP — read anything, write only what's yours:
 *   location, propertyType, isPublished  → [TDN] geo-search + filter (reads)
 *   availability, blackoutDates          → [GG]  calendar / slot locking
 *   operatingHours                       → [TDN] mall hours guard
 *   chargerSpec                          → [SMR] provisioning, [GG] tariff (reads)
 *   entranceLocation                     → [MI]  navigation target
 *   avgRating, ratingCount               → [GG]  reviews
 *   verification fields                  → [SMR] host verification
 * ============================================================================
 */
const mongoose = require('mongoose');
const { PROPERTY_TYPE, CONNECTOR_TYPE } = require('../shared/constants');

/** One recurring weekly availability window. dayOfWeek: 0=Sunday … 6=Saturday. */
const availabilitySchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startMinute: { type: Number, min: 0, max: 1439, required: true }, // minutes from midnight
    endMinute: { type: Number, min: 1, max: 1440, required: true },
  },
  { _id: false }
);

const propertySchema = new mongoose.Schema(
  {
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    propertyType: { type: String, enum: Object.values(PROPERTY_TYPE), required: true },

    address: {
      line1: { type: String, trim: true, required: true },
      area: { type: String, trim: true, default: null },
      city: { type: String, trim: true, default: 'Dhaka' },
      postcode: { type: String, trim: true, default: null },
      landmark: { type: String, trim: true, default: null },
    },

    /** GeoJSON [longitude, latitude] — the pin shown on the map. */
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (c) =>
            Array.isArray(c) && c.length === 2 && c[0] >= -180 && c[0] <= 180 && c[1] >= -90 && c[1] <= 90,
          message: 'coordinates must be [longitude, latitude]',
        },
      },
    },

    /** [MI] Exact gate/entrance the driver is routed to — often ≠ the pin. */
    entranceLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined },
      instructions: { type: String, trim: true, default: null },
    },

    /* ------------------------------------------------------------ pricing */
    pricePerHourPoisha: { type: Number, required: true, min: 0 },
    totalSlots: { type: Number, default: 1, min: 1 },

    /* ----------------------------------------------------------- charging */
    hasCharger: { type: Boolean, default: false },
    chargerSpec: {
      kw: { type: Number, min: 0, max: 400, default: null },
      connectorType: { type: String, enum: [...Object.values(CONNECTOR_TYPE), null], default: null },
      // Host's own electricity overhead on top of the BERC rate — [GG] tariff
      overheadPoishaPerKwh: { type: Number, default: 0, min: 0 },
    },

    /* --------------------------------------------------- [GG] availability */
    availability: { type: [availabilitySchema], default: [] },
    blackoutDates: { type: [Date], default: [] },

    /* -------------------------------------------- [TDN] mall opening hours */
    operatingHours: {
      is24x7: { type: Boolean, default: false },
      openMinute: { type: Number, min: 0, max: 1439, default: 480 },   // 08:00
      closeMinute: { type: Number, min: 1, max: 1440, default: 1320 }, // 22:00
    },

    /* -------------------------------------------------------- publication */
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    photos: { type: [String], default: [] },
    amenities: { type: [String], default: [] }, // CCTV, GUARD, COVERED, LIFT_ACCESS

    /* -------------------------------------------------------- [GG] rating */
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'properties' }
);

/* ---------------------------------------------------------------- indexes */
propertySchema.index({ location: '2dsphere' });                    // [TDN] $geoNear
propertySchema.index({ propertyType: 1, isPublished: 1 });         // [TDN] filter toggle
propertySchema.index({ hostId: 1, isPublished: 1 });
propertySchema.index({ hasCharger: 1, pricePerHourPoisha: 1 });

module.exports = mongoose.models.Property || mongoose.model('Property', propertySchema);
