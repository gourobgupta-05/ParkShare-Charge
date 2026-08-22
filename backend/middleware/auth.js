/**
 * ============================================================================
 * AUTH MIDDLEWARE — 🔒 DO NOT EDIT AFTER INITIAL SETUP
 * ============================================================================
 * Used by all four members. Import, don't rewrite.
 *
 *   const { authenticate, authorize, requireVerifiedHost } = require('../../middleware/auth');
 *   router.get('/mine', authenticate, authorize(ROLES.HOST), controller.list);
 *
 * After `authenticate`, `req.user` is the full Mongoose user document and
 * `req.userId` is the string id.
 * ============================================================================
 */
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/token');
const { ROLES, ACCOUNT_STATE, VERIFICATION_STATUS, ERROR_CODES } = require('../shared/constants');
const User = require('../models/User');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.query && typeof req.query.token === 'string') return req.query.token; // socket handshake fallback
  return null;
}

/** Requires a valid access token. Attaches req.user / req.userId. */
const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Sign in to continue');

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    throw ApiError.unauthorized(
      expired ? 'Your session expired. Sign in again.' : 'Invalid session token',
      expired ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.UNAUTHORIZED
    );
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('This account no longer exists');

  if (user.accountState === ACCOUNT_STATE.SUSPENDED) {
    throw ApiError.forbidden('This account is suspended', ERROR_CODES.ACCOUNT_SUSPENDED);
  }

  req.user = user;
  req.userId = String(user._id);
  next();
});

/** Attaches req.user when a token is present, but never rejects. */
const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user) {
      req.user = user;
      req.userId = String(user._id);
    }
  } catch {
    /* ignore — this route works signed out too */
  }
  next();
});

/**
 * Role guard. Call AFTER authenticate.
 *   authorize(ROLES.HOST)                 → hosts only
 *   authorize(ROLES.HOST, ROLES.ADMIN)    → either
 */
function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!allowedRoles.length || allowedRoles.includes(req.user.role)) return next();
    return next(
      ApiError.forbidden(`This action is for ${allowedRoles.join(' or ').toLowerCase()} accounts`)
    );
  };
}

/** Admin shorthand. */
const requireAdmin = authorize(ROLES.ADMIN);

/**
 * Host must have passed the [SMR] verification pipeline before publishing a
 * property or receiving payouts. Admins bypass.
 */
function requireVerifiedHost(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role === ROLES.ADMIN) return next();
  if (req.user.role !== ROLES.HOST) {
    return next(ApiError.forbidden('This action is for host accounts'));
  }
  if (req.user.verificationStatus !== VERIFICATION_STATUS.APPROVED) {
    return next(
      ApiError.forbidden(
        'Finish host verification before doing this',
        ERROR_CODES.HOST_NOT_VERIFIED
      )
    );
  }
  next();
}

/**
 * Blocks a driver whose account was locked by the [SMR] penalty worker.
 * Apply to booking-creating routes, not to payment routes — a locked driver
 * must still be able to pay off the penalty.
 */
function blockIfPenaltyLocked(req, _res, next) {
  if (req.user && req.user.accountState === ACCOUNT_STATE.LOCKED_PENALTY) {
    return next(
      ApiError.forbidden(
        'Your account is locked until the outstanding penalty is paid',
        ERROR_CODES.ACCOUNT_LOCKED_PENALTY
      )
    );
  }
  next();
}

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  requireAdmin,
  requireVerifiedHost,
  blockIfPenaltyLocked,
};
