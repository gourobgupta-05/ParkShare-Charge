/**
 * REVIEW — OWNER: Gourob Gupta [GG]
 * Feature-local model. Shared schemas in backend/models are NOT redefined.
 *
 * One review per booking, enforced by a unique index — a driver cannot pad a
 * host's average by reviewing the same session twice.
 */
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },

    rating: { type: Number, required: true, min: 1, max: 5 },

    /** Optional sub-scores. They colour the display but never the average. */
    subRatings: {
      accuracy: { type: Number, min: 1, max: 5, default: null },
      access: { type: Number, min: 1, max: 5, default: null },
      cleanliness: { type: Number, min: 1, max: 5, default: null },
      charging: { type: Number, min: 1, max: 5, default: null },
    },

    comment: { type: String, trim: true, maxlength: 1000, default: '' },
    tags: { type: [String], default: [] }, // EASY_ACCESS, WELL_LIT, TIGHT_SPACE, FAST_CHARGER…

    /** Verification matrix — was this a real, completed, checked-in session? */
    verification: {
      isVerifiedSession: { type: Boolean, default: false },
      checkedInAt: { type: Date, default: null },
      sessionKwh: { type: Number, default: 0 },
      durationMinutes: { type: Number, default: 0 },
    },

    hostReply: {
      body: { type: String, trim: true, maxlength: 600, default: null },
      repliedAt: { type: Date, default: null },
    },

    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'reviews' }
);

reviewSchema.index({ propertyId: 1, createdAt: -1 });
reviewSchema.index({ hostId: 1, rating: -1 });

module.exports = mongoose.models.Review || mongoose.model('Review', reviewSchema);
