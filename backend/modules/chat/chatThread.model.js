/**
 * CHAT THREAD — OWNER: Maidul Islam [MI]
 * One thread per booking. Participants are stored as ids only; no phone
 * number or email is ever denormalised onto the thread.
 */
const mongoose = require('mongoose');

const chatThreadSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    lastMessageAt: { type: Date, default: null },
    /** Plaintext preview is deliberately NOT stored — only a length hint. */
    lastMessageBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    messageCount: { type: Number, default: 0 },

    unread: {
      driver: { type: Number, default: 0 },
      host: { type: Number, default: 0 },
    },

    isClosed: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'chat_threads' }
);

chatThreadSchema.index({ driverId: 1, lastMessageAt: -1 });
chatThreadSchema.index({ hostId: 1, lastMessageAt: -1 });

module.exports = mongoose.models.ChatThread || mongoose.model('ChatThread', chatThreadSchema);
