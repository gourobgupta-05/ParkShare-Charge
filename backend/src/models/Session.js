const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Session Model (Charging / Parking Session)
 * Owner: Gourob Gupta — Module 1
 *
 * Represents a single driver-host charging session. Feedback can only be
 * submitted once a session's status is COMPLETED — this is the object the
 * "Driver-Side Post-Session Feedback & Verification Matrix" feature
 * verifies against before accepting a review.
 *
 * NOTE: The full booking/calendar-locking logic (overlap prevention,
 * compound date-range schema) belongs to Gourob's separate Module 2 item
 * ("Live Interactive Calendar Scheduler & Slot Locking"). This Session
 * model only carries the fields F1 needs to validate and display a
 * completed session — extend it there, don't fork it.
 */
const sessionSchema = new Schema(
  {
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
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'ACTIVE', 'COMPLETED', 'SHUTDOWN', 'CANCELLED'],
      default: 'PENDING',
    },
    startTime: {
      type: Date,
      required: [true, 'startTime is required'],
    },
    endTime: {
      type: Date,
    },
    energyConsumedKwh: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    feedbackSubmitted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema);
