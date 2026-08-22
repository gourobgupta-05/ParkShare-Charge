/**
 * ============================================================================
 * USER (base) — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * ============================================================================
 * Driver, Host and Admin all live in ONE `users` collection using Mongoose
 * discriminators keyed on `role`. This means:
 *   - one login endpoint, one auth middleware, one `req.user`
 *   - Driver.find() only returns drivers; User.find() returns everyone
 * Role-specific fields live in models/Driver.js and models/Host.js.
 * ============================================================================
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { ROLES, ACCOUNT_STATE, PAYMENT_METHOD } = require('../shared/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },

    role: { type: String, enum: Object.values(ROLES), required: true },
    accountState: {
      type: String,
      enum: Object.values(ACCOUNT_STATE),
      default: ACCOUNT_STATE.ACTIVE,
    },

    avatarUrl: { type: String, default: null },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },

    // Common feature 2 — profile & access management
    notificationPrefs: {
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
    preferredPaymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      default: PAYMENT_METHOD.WALLET,
    },
    fcmTokens: { type: [String], default: [] }, // [SMR] push notifications

    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    discriminatorKey: 'role',
    collection: 'users',
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/* --------------------------------------------------------------- indexes -- */
userSchema.index({ role: 1, accountState: 1 });
userSchema.index({ createdAt: -1 });

/* ---------------------------------------------------------------- hooks --- */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, env.BCRYPT_SALT_ROUNDS);
  next();
});

/* -------------------------------------------------------------- methods --- */
/** Compare a plaintext password. Requires the doc to be loaded with +passwordHash. */
userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.passwordHash) {
    throw new Error('Load the user with .select("+passwordHash") before comparing');
  }
  return bcrypt.compare(plain, this.passwordHash);
};

/** Sets a new password; the pre-save hook does the hashing. */
userSchema.methods.setPassword = function setPassword(plain) {
  this.passwordHash = plain;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
