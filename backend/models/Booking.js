/**
 * ============================================================================
 * BOOKING — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * ============================================================================
 * ⚠️ THE INTEGRATION BUS. All four members touch this document, so writes are
 * partitioned by sub-object. READ anything. WRITE only your own block.
 *
 *   driverId/propertyId/hostId/startAt/endAt/status(initial) → [GG]  calendar
 *   pricing                                                  → [GG]  tariff
 *   promo                                                    → [MI]  promo
 *   escrow                                                   → [TDN] escrow
 *   mallHoursCheck                                           → [TDN] mall hours
 *   navigation                                               → [MI]  navigation
 *   sessionId                                                → [MI]  iot-grid
 *   checkIn                                                  → [SMR] geofence
 *   checkOut                                                 → [SMR] penalty
 *   settlement                                               → [SMR] payout
 *   reviewId                                                 → [GG]  reviews
 *
 * `status` may ONLY be written by the service named in BOOKING_TRANSITIONS
 * (shared/constants.js). Use booking.transitionTo() — it validates for you.
 * ============================================================================
 */
const mongoose = require('mongoose');
const {
  BOOKING_STATUS,
  BLOCKING_STATUSES,
  ESCROW_STATUS,
  canTransition,
} = require('../shared/constants');

const bookingSchema = new mongoose.Schema(
  {
    /* ------------------------------------------------------- [GG] core --- */
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },

    startAt: { type: Date, required: true },  // stored UTC, displayed Asia/Dhaka
    endAt: { type: Date, required: true },

    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.PENDING_PAYMENT,
      index: true,
    },
    /**
     * True while this booking occupies the slot. Maintained by the pre-save
     * hook below — never set it by hand. Backs the partial unique index that
     * makes double-booking impossible at the database level.
     */
    isBlocking: { type: Boolean, default: true },

    /* ---------------------------------------------------- [GG] pricing --- */
    pricing: {
      basePoisha: { type: Number, default: 0, min: 0 },        // parking fee
      energyPoisha: { type: Number, default: 0, min: 0 },      // BERC electricity
      discountPoisha: { type: Number, default: 0, min: 0 },    // from promo
      vatPoisha: { type: Number, default: 0, min: 0 },
      processingFeePoisha: { type: Number, default: 0, min: 0 },
      totalPoisha: { type: Number, default: 0, min: 0 },
      estimatedKwh: { type: Number, default: 0, min: 0 },
    },

    /* ------------------------------------------------------ [MI] promo --- */
    promo: {
      code: { type: String, trim: true, uppercase: true, default: null },
      promoId: { type: mongoose.Schema.Types.ObjectId, ref: 'PromoCode', default: null },
      discountPoisha: { type: Number, default: 0, min: 0 },
    },

    /* ----------------------------------------------------- [TDN] escrow --- */
    escrow: {
      paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
      status: { type: String, enum: Object.values(ESCROW_STATUS), default: ESCROW_STATUS.NONE },
      heldPoisha: { type: Number, default: 0, min: 0 },
      heldAt: { type: Date, default: null },
      releasedAt: { type: Date, default: null },
    },

    /* -------------------------------------------------- [TDN] mall hours --- */
    mallHoursCheck: {
      passed: { type: Boolean, default: null },
      checkedAt: { type: Date, default: null },
      reason: { type: String, default: null },
    },

    /* -------------------------------------------------- [MI] navigation --- */
    navigation: {
      routeId: { type: String, default: null },
      etaSeconds: { type: Number, default: null },
      distanceMeters: { type: Number, default: null },
      startedAt: { type: Date, default: null },
    },

    /* ------------------------------------------------------- [MI] iot --- */
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },

    /* -------------------------------------------------- [SMR] check-in --- */
    checkIn: {
      at: { type: Date, default: null },
      coordinates: { type: [Number], default: undefined }, // [lng, lat] at trigger
      distanceMeters: { type: Number, default: null },
      method: { type: String, enum: ['GEOFENCE', 'QR_PASS', 'MANUAL', null], default: null },
      passId: { type: String, default: null },
    },

    /* ------------------------------------------------- [SMR] check-out --- */
    checkOut: {
      at: { type: Date, default: null },
      isLate: { type: Boolean, default: false },
      lateMinutes: { type: Number, default: 0 },
      penaltyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Penalty', default: null },
    },

    /* ------------------------------------------------- [SMR] settlement --- */
    settlement: {
      payoutBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayoutBatch', default: null },
      hostCreditPoisha: { type: Number, default: 0, min: 0 },
      commissionPoisha: { type: Number, default: 0, min: 0 },
      settledAt: { type: Date, default: null },
    },

    /* ----------------------------------------------------- [GG] review --- */
    reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Review', default: null },

    cancelledReason: { type: String, default: null },
  },
  { timestamps: true, collection: 'bookings' }
);

/* ---------------------------------------------------------------- hooks --- */
bookingSchema.pre('save', function syncBlocking(next) {
  this.isBlocking = BLOCKING_STATUSES.includes(this.status);
  next();
});

/* -------------------------------------------------------------- indexes --- */
/**
 * DOUBLE-BOOKING GUARD ([GG] owns the overlap logic that sits on top of this).
 * Two live bookings can never share the same property + start time. Overlap
 * checking still happens in the service layer, but this index is the last line
 * of defence against a race between two drivers tapping "Book" simultaneously.
 */
bookingSchema.index(
  { propertyId: 1, startAt: 1 },
  { unique: true, partialFilterExpression: { isBlocking: true } }
);
bookingSchema.index({ propertyId: 1, startAt: 1, endAt: 1 });
bookingSchema.index({ driverId: 1, status: 1, startAt: -1 });
bookingSchema.index({ hostId: 1, status: 1, startAt: -1 });
bookingSchema.index({ status: 1, endAt: 1 }); // [SMR] penalty worker sweep

/* -------------------------------------------------------------- methods --- */
/**
 * The ONLY approved way to change status. Throws if the transition is illegal,
 * which stops one member's feature from corrupting another's assumptions.
 */
bookingSchema.methods.transitionTo = function transitionTo(nextStatus) {
  if (!canTransition(this.status, nextStatus)) {
    const err = new Error(`Cannot move a booking from ${this.status} to ${nextStatus}`);
    err.statusCode = 409;
    throw err;
  }
  this.status = nextStatus;
  return this;
};

bookingSchema.virtual('durationMinutes').get(function durationMinutes() {
  return Math.round((this.endAt - this.startAt) / 60000);
});

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
