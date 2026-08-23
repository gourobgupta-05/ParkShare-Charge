/**
 * NOTIFICATION — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * In-app notification feed. [SMR] mirrors every Firebase push into this so the
 * bell icon still works when push is blocked or the mock provider is active.
 */
const mongoose = require('mongoose');
const { NOTIFICATION_TYPE } = require('../shared/constants');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPE), required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    deepLink: { type: String, default: null },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: 'notifications' }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
