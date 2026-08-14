const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Feedback Model
 * F1: Driver-Side Post-Session Feedback & Verification Matrix
 * Owner: Gourob Gupta — Module 1
 */
const feedbackSchema = new Schema(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'Session',
      required: [true, 'sessionId is required'],
      index: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'driverId is required'],
      index: true,
    },
    hostId: {
      type: Schema.Types.ObjectId,
      ref: 'Host',
      required: [true, 'hostId is required'],
      index: true,
    },
    ratingReliability: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    ratingSafety: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    ratingEfficiency: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// One feedback submission per session — blocks duplicate/spam reviews
feedbackSchema.index({ sessionId: 1, driverId: 1 }, { unique: true });

// Auto-calculate the per-submission overall average before validation
feedbackSchema.pre('validate', function (next) {
  if (this.ratingReliability && this.ratingSafety && this.ratingEfficiency) {
    const avg =
      (this.ratingReliability + this.ratingSafety + this.ratingEfficiency) / 3;
    this.overallRating = Math.round(avg * 10) / 10; // 1 decimal place
  }
  next();
});

module.exports = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
