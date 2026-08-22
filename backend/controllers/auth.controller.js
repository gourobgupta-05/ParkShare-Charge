/**
 * ============================================================================
 * AUTH + PROFILE CONTROLLER — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * ============================================================================
 * COMMON FEATURE 1: Registration & Login (separate Driver / Host flows)
 * COMMON FEATURE 2: Profile & Access Management
 *
 * Owned by the repo initializer. If your feature needs something from here,
 * open a chore/contract PR — do not add endpoints to this file.
 * ============================================================================
 */
const mongoose = require('mongoose');
const { Driver, Host, User, Wallet } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/token');
const { ROLES, ERROR_CODES, VERIFICATION_STATUS } = require('../shared/constants');
const logger = require('../utils/logger');

/** Shared auth payload returned by register / login / refresh. */
function authPayload(user) {
  return {
    user: user.toJSON(),
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

async function assertUnique({ email, phone }) {
  const clash = await User.findOne({ $or: [{ email }, { phone }] }).lean();
  if (!clash) return;
  if (clash.email === email) {
    throw ApiError.conflict('That email is already registered', ERROR_CODES.EMAIL_TAKEN);
  }
  throw ApiError.conflict('That phone number is already registered', ERROR_CODES.PHONE_TAKEN);
}

/* ==========================================================================
 * POST /api/auth/register/driver
 * Driver signup — personal info + EV specs
 * ========================================================================== */
const registerDriver = asyncHandler(async (req, res) => {
  const { name, email, phone, password, ev = {}, drivingLicenceNo } = req.body;

  await assertUnique({ email: email.toLowerCase(), phone });

  const driver = new Driver({
    name,
    email: email.toLowerCase(),
    phone,
    passwordHash: password, // hashed by the pre-save hook
    role: ROLES.DRIVER,
    drivingLicenceNo: drivingLicenceNo || null,
    ev: {
      make: ev.make || null,
      model: ev.model || null,
      batteryKwh: ev.batteryKwh ?? null,
      connectorType: ev.connectorType || null,
      plateNumber: ev.plateNumber || null,
      colour: ev.colour || null,
    },
  });
  await driver.save();

  // Every driver gets a wallet — the escrow [TDN] feature assumes it exists.
  await Wallet.create({ ownerId: driver._id, ownerRole: ROLES.DRIVER, balancePoisha: 0 });

  logger.info(`New driver registered: ${driver.email}`);
  return created(res, authPayload(driver), 'Account created');
});

/* ==========================================================================
 * POST /api/auth/register/host
 * Host signup — property specs + Residential|Mall + location
 * ========================================================================== */
const registerHost = asyncHandler(async (req, res) => {
  const {
    name, email, phone, password,
    propertyType, businessName,
    address = {}, latitude, longitude,
  } = req.body;

  await assertUnique({ email: email.toLowerCase(), phone });

  const host = new Host({
    name,
    email: email.toLowerCase(),
    phone,
    passwordHash: password,
    role: ROLES.HOST,
    propertyType,
    businessName: businessName || null,
    address: {
      line1: address.line1,
      area: address.area || null,
      city: address.city || 'Dhaka',
      postcode: address.postcode || null,
    },
    // GeoJSON is [longitude, latitude] — order matters.
    location: { type: 'Point', coordinates: [Number(longitude), Number(latitude)] },
    verificationStatus: VERIFICATION_STATUS.DRAFT,
  });
  await host.save();

  await Wallet.create({ ownerId: host._id, ownerRole: ROLES.HOST, balancePoisha: 0 });

  logger.info(`New host registered: ${host.email} (${propertyType})`);
  return created(
    res,
    { ...authPayload(host), nextStep: 'HOST_VERIFICATION' },
    'Account created. Complete verification to publish a space.'
  );
});

/* ==========================================================================
 * POST /api/auth/login   — one endpoint for every role
 * ========================================================================== */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Email or password is incorrect', ERROR_CODES.INVALID_CREDENTIALS);
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  return ok(res, authPayload(user), 'Signed in');
});

/* ==========================================================================
 * POST /api/auth/refresh
 * ========================================================================== */
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw ApiError.badRequest('Refresh token is required');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Your session expired. Sign in again.', ERROR_CODES.TOKEN_EXPIRED);
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('This account no longer exists');

  return ok(res, authPayload(user), 'Session refreshed');
});

/* ==========================================================================
 * GET /api/auth/me
 * ========================================================================== */
const me = asyncHandler(async (req, res) => ok(res, { user: req.user.toJSON() }));

/* ==========================================================================
 * PATCH /api/profile — edit profile (role-aware, whitelisted fields only)
 * ========================================================================== */
const updateProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const b = req.body;

  // Fields anyone may change
  if (b.name !== undefined) user.name = b.name;
  if (b.avatarUrl !== undefined) user.avatarUrl = b.avatarUrl;
  if (b.phone !== undefined && b.phone !== user.phone) {
    const taken = await User.findOne({ phone: b.phone, _id: { $ne: user._id } }).lean();
    if (taken) throw ApiError.conflict('That phone number is already registered', ERROR_CODES.PHONE_TAKEN);
    user.phone = b.phone;
    user.isPhoneVerified = false;
  }

  // Driver-only
  if (user.role === ROLES.DRIVER && b.ev) {
    user.ev = { ...user.ev.toObject?.() ?? user.ev, ...b.ev };
  }

  // Host-only. propertyType and verificationStatus are deliberately NOT
  // editable here — category changes and verification are [SMR]'s pipeline.
  if (user.role === ROLES.HOST) {
    if (b.businessName !== undefined) user.businessName = b.businessName;
    if (b.address) user.address = { ...user.address.toObject?.() ?? user.address, ...b.address };
    if (b.latitude !== undefined && b.longitude !== undefined) {
      user.location = { type: 'Point', coordinates: [Number(b.longitude), Number(b.latitude)] };
    }

    // Payout channel — where earnings are withdrawn to. Required before the
    // payout feature will release a withdrawal.
    if (b.payoutChannel) {
      const allowed = ['BKASH', 'BANK', 'NAGAD'];
      const type = b.payoutChannel.type ? String(b.payoutChannel.type).toUpperCase() : null;

      if (type && !allowed.includes(type)) {
        throw ApiError.badRequest('Choose a supported payout method', undefined, {
          'payoutChannel.type': `Must be one of: ${allowed.join(', ')}`,
        });
      }

      // Only the last 4 digits are ever stored — never a full account number.
      const raw = b.payoutChannel.accountRef ? String(b.payoutChannel.accountRef).trim() : null;
      if (type && !raw) {
        throw ApiError.badRequest('Add the account it should be paid into', undefined, {
          'payoutChannel.accountRef': 'Account reference is required',
        });
      }
      const masked = raw ? `${'*'.repeat(Math.max(raw.length - 4, 0))}${raw.slice(-4)}` : null;

      user.payoutChannel = { type, accountRef: masked };
    }
  }

  await user.save();
  return ok(res, { user: user.toJSON() }, 'Profile updated');
});

/* ==========================================================================
 * PATCH /api/profile/password
 * ========================================================================== */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.userId).select('+passwordHash');
  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect', ERROR_CODES.INVALID_CREDENTIALS, {
      currentPassword: 'Current password is incorrect',
    });
  }
  if (currentPassword === newPassword) {
    throw ApiError.badRequest('Choose a password you have not used here before', undefined, {
      newPassword: 'New password must be different',
    });
  }

  user.setPassword(newPassword);
  await user.save();

  // Rotate tokens so other sessions are invalidated on next refresh.
  return ok(res, authPayload(user), 'Password changed');
});

/* ==========================================================================
 * PATCH /api/profile/preferences — notification toggles + payment channel
 * ========================================================================== */
const updatePreferences = asyncHandler(async (req, res) => {
  const { notificationPrefs, preferredPaymentMethod, fcmToken } = req.body;
  const user = req.user;

  if (notificationPrefs) {
    user.notificationPrefs = {
      ...user.notificationPrefs.toObject?.() ?? user.notificationPrefs,
      ...notificationPrefs,
    };
  }
  if (preferredPaymentMethod) user.preferredPaymentMethod = preferredPaymentMethod;
  if (fcmToken && !user.fcmTokens.includes(fcmToken)) user.fcmTokens.push(fcmToken);

  await user.save();
  return ok(res, { user: user.toJSON() }, 'Preferences saved');
});

/* ==========================================================================
 * POST /api/auth/logout — clears this device's push token
 * ========================================================================== */
const logout = asyncHandler(async (req, res) => {
  const { fcmToken } = req.body || {};
  if (fcmToken) {
    await User.updateOne({ _id: req.userId }, { $pull: { fcmTokens: fcmToken } });
  }
  return ok(res, null, 'Signed out');
});

/* ==========================================================================
 * DELETE /api/profile — soft delete
 * ========================================================================== */
const deactivateAccount = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      req.user.accountState = 'SUSPENDED';
      req.user.fcmTokens = [];
      await req.user.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return ok(res, null, 'Account deactivated');
});

module.exports = {
  registerDriver,
  registerHost,
  login,
  refresh,
  me,
  logout,
  updateProfile,
  changePassword,
  updatePreferences,
  deactivateAccount,
};
