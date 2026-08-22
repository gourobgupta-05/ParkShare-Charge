/**
 * MESSAGE — OWNER: Maidul Islam [MI]
 *
 * The body is stored ONLY as AES-256-GCM ciphertext. There is no plaintext
 * field, deliberately: if one existed, someone would eventually write to it.
 * Decryption happens in the service layer on read.
 */
const mongoose = require('mongoose');
const { ROLES } = require('../../shared/constants');

const messageSchema = new mongoose.Schema(
  {
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatThread', required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: Object.values(ROLES), required: true },

    /* --- encrypted payload --- */
    cipherText: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },

    /** True when contact details were stripped before encryption. */
    wasRedacted: { type: Boolean, default: false },
    redactedKinds: { type: [String], default: [] },

    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'chat_messages' }
);

messageSchema.index({ threadId: 1, createdAt: -1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
