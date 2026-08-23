/**
 * ============================================================================
 * PROMO CODE ENGINE — OWNER: Maidul Islam [MI]
 * ============================================================================
 * Validates a code string against the active promo collection and applies a
 * flat discount to a booking.
 *
 * WHAT THIS FEATURE WRITES
 * Only `booking.promo` — an [MI]-owned field. It deliberately does NOT touch
 * `booking.pricing`, which belongs to [GG]'s tariff engine. The flow is:
 *
 *     apply promo  →  booking.promo.discountPoisha set   [MI]
 *     re-price     →  tariff reads booking.promo and     [GG]
 *                     recomputes pricing + VAT
 *     pay          →  escrow charges pricing.totalPoisha [TDN]
 *
 * Discounting before VAT is deliberate: VAT is owed on the amount actually
 * paid, so applying it to the discounted subtotal is the correct treatment.
 * ============================================================================
 */
const mongoose = require('mongoose');
const { Booking, Property } = require('../../models');
const PromoCode = require('./promoCode.model');
const PromoRedemption = require('./promoRedemption.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { formatPoisha } = require('../../utils/money');
const { PROPERTY_TYPE, BOOKING_STATUS, ERROR_CODES, ROLES, PLATFORM } = require('../../shared/constants');
const { normaliseCode } = require('./promo.validator');

const GLOBAL_CAP = Number(process.env.PROMO_MAX_DISCOUNT_POISHA) || PLATFORM.PROMO_MAX_DISCOUNT_POISHA;

/* ------------------------------------------------------------------------ */
/* Validation                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Runs every rule and returns a verdict. Never throws for a *business* reason
 * — an invalid code is a normal outcome, not an exception — so the UI can show
 * a specific message instead of a generic failure.
 *
 * @returns {{valid: boolean, reason?: string, code?: string, discountPoisha?: number, promo?: object}}
 */
async function evaluate({ code, booking, property, driverId }) {
  const promo = await PromoCode.findOne({ code: code.toUpperCase() });

  if (!promo) {
    return { valid: false, reason: 'That code does not exist', errorCode: ERROR_CODES.PROMO_INVALID };
  }
  if (!promo.isActive) {
    return { valid: false, reason: 'That code is no longer active', errorCode: ERROR_CODES.PROMO_INVALID };
  }

  const now = new Date();
  if (promo.validFrom && now < promo.validFrom) {
    return {
      valid: false,
      reason: `That code starts on ${promo.validFrom.toISOString().slice(0, 10)}`,
      errorCode: ERROR_CODES.PROMO_INVALID,
    };
  }
  if (promo.validTo && now > promo.validTo) {
    return { valid: false, reason: 'That code has expired', errorCode: ERROR_CODES.PROMO_EXPIRED };
  }
  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
    return { valid: false, reason: 'That code has been fully claimed', errorCode: ERROR_CODES.PROMO_EXPIRED };
  }

  /* ------------------------------------------------------------- scope --- */
  if (promo.propertyType && property.propertyType !== promo.propertyType) {
    const label = promo.propertyType === PROPERTY_TYPE.MALL ? 'commercial mall parking' : 'residential spaces';
    return { valid: false, reason: `That code only works on ${label}`, errorCode: ERROR_CODES.PROMO_INVALID };
  }
  if (promo.propertyIds?.length && !promo.propertyIds.some((id) => String(id) === String(property._id))) {
    return {
      valid: false,
      reason: `That code is not valid at ${property.title}`,
      errorCode: ERROR_CODES.PROMO_INVALID,
    };
  }
  if (promo.hostId && String(promo.hostId) !== String(booking.hostId)) {
    return { valid: false, reason: 'That code is not valid for this host', errorCode: ERROR_CODES.PROMO_INVALID };
  }

  /* ------------------------------------------------------- spend floor --- */
  // Compare against the pre-discount subtotal, falling back to the parking fee
  // when the tariff engine has not priced the booking yet.
  const subtotal =
    (booking.pricing?.basePoisha || 0) + (booking.pricing?.energyPoisha || 0) ||
    Math.ceil((property.pricePerHourPoisha * Math.round((booking.endAt - booking.startAt) / 60000)) / 60);

  if (promo.minSpendPoisha && subtotal < promo.minSpendPoisha) {
    return {
      valid: false,
      reason: `Spend at least ${formatPoisha(promo.minSpendPoisha)} to use that code`,
      errorCode: ERROR_CODES.PROMO_INVALID,
    };
  }

  /* -------------------------------------------------------- per-driver --- */
  const used = await PromoRedemption.countDocuments({
    promoId: promo._id,
    driverId,
    releasedAt: null,
    bookingId: { $ne: booking._id },
  });
  if (used >= promo.perUserLimit) {
    return {
      valid: false,
      reason:
        promo.perUserLimit === 1
          ? 'You have already used that code'
          : `That code can only be used ${promo.perUserLimit} times per account`,
      errorCode: ERROR_CODES.PROMO_INVALID,
    };
  }

  /* ---------------------------------------------------------- discount --- */
  // Never exceed the subtotal, the code's own cap, or the platform ceiling.
  const discountPoisha = Math.max(
    Math.min(promo.discountPoisha, promo.maxDiscountPoisha || Infinity, GLOBAL_CAP, subtotal),
    0
  );

  if (discountPoisha <= 0) {
    return { valid: false, reason: 'That code has no value on this booking', errorCode: ERROR_CODES.PROMO_INVALID };
  }

  return {
    valid: true,
    promo,
    code: promo.code,
    partnerName: promo.partnerName,
    description: promo.description,
    subtotalPoisha: subtotal,
    discountPoisha,
    cappedByBooking: discountPoisha < promo.discountPoisha,
  };
}

/** Loads the booking, checks ownership, and returns it with its property. */
async function loadBooking(bookingId, driverId, role) {
  if (!mongoose.isValidObjectId(bookingId)) throw ApiError.badRequest('That is not a valid booking id');

  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('That booking no longer exists');

  if (String(booking.driverId) !== String(driverId) && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You can only use a promo code on your own booking');
  }
  if (booking.status !== BOOKING_STATUS.PENDING_PAYMENT) {
    throw ApiError.badRequest(
      booking.escrow?.status === 'HELD'
        ? 'This booking is already paid — a code cannot be added now'
        : 'A promo code can only be added before payment',
      ERROR_CODES.BOOKING_STATE_INVALID
    );
  }

  const property = await Property.findById(booking.propertyId)
    .select('title propertyType pricePerHourPoisha')
    .lean();
  if (!property) throw ApiError.notFound('That space no longer exists');

  return { booking, property };
}

/* ------------------------------------------------------------------------ */
/* Operations                                                               */
/* ------------------------------------------------------------------------ */

/** Dry run — checks a code without claiming it. Powers the live field hint. */
async function validateCode({ code, bookingId, driverId, role }) {
  const { booking, property } = await loadBooking(bookingId, driverId, role);
  const verdict = await evaluate({ code: normaliseCode(code), booking, property, driverId });

  if (!verdict.valid) {
    return {
      valid: false,
      code: String(code).toUpperCase(),
      reason: verdict.reason,
      errorCode: verdict.errorCode,
    };
  }

  return {
    valid: true,
    code: verdict.code,
    partnerName: verdict.partnerName,
    description: verdict.description,
    discountPoisha: verdict.discountPoisha,
    subtotalPoisha: verdict.subtotalPoisha,
    cappedByBooking: verdict.cappedByBooking,
  };
}

/**
 * Claims the code against the booking.
 *
 * The unique index on (promoId, bookingId) is the real guard: two concurrent
 * applies cannot both create a redemption, so usedCount can never overshoot
 * usageLimit. The counter is incremented conditionally in the same spirit.
 */
async function applyCode({ code, bookingId, driverId, role }) {
  const { booking, property } = await loadBooking(bookingId, driverId, role);
  const normalised = normaliseCode(code);

  const verdict = await evaluate({ code: normalised, booking, property, driverId });
  if (!verdict.valid) {
    throw ApiError.badRequest(verdict.reason, verdict.errorCode, { code: verdict.reason });
  }

  const { promo, discountPoisha } = verdict;

  // Swapping codes: release whatever was on the booking first.
  if (booking.promo?.promoId && String(booking.promo.promoId) !== String(promo._id)) {
    await releaseRedemption(booking);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Conditional increment — refuses to push usedCount past the limit.
      const filter = { _id: promo._id, isActive: true };
      if (promo.usageLimit !== null) filter.usedCount = { $lt: promo.usageLimit };

      const claimed = await PromoCode.updateOne(filter, { $inc: { usedCount: 1 } }, { session });
      if (claimed.modifiedCount !== 1) {
        throw ApiError.conflict('That code was fully claimed a moment ago', ERROR_CODES.PROMO_EXPIRED);
      }

      await PromoRedemption.create(
        [
          {
            promoId: promo._id,
            code: promo.code,
            bookingId: booking._id,
            driverId: booking.driverId,
            discountPoisha,
          },
        ],
        { session }
      );

      // booking.promo is the only field this feature writes.
      await Booking.updateOne(
        { _id: booking._id },
        { $set: { promo: { code: promo.code, promoId: promo._id, discountPoisha } } },
        { session }
      );
    });
  } catch (err) {
    if (err.code === 11000) {
      throw ApiError.conflict('That code is already applied to this booking');
    }
    if (/Transaction numbers are only allowed on a replica set/i.test(err.message || '')) {
      throw new ApiError(
        500,
        'Promo codes need a MongoDB replica set. Point MONGO_URI at MongoDB Atlas (the free M0 tier is one).',
        ERROR_CODES.INTERNAL
      );
    }
    throw err;
  } finally {
    await session.endSession();
  }

  logger.info(`[promo] ${promo.code} applied to booking ${booking._id} (-${discountPoisha} poisha)`);

  return {
    bookingId: booking._id,
    code: promo.code,
    partnerName: promo.partnerName,
    discountPoisha,
    // The fare is recomputed by [GG]'s tariff engine, which reads booking.promo.
    nextStep: 'REPRICE_BOOKING',
  };
}

/** Frees a redemption so the code can be used again. */
async function releaseRedemption(booking) {
  if (!booking.promo?.promoId) return null;

  await PromoRedemption.updateOne(
    { promoId: booking.promo.promoId, bookingId: booking._id, releasedAt: null },
    { $set: { releasedAt: new Date() } }
  );
  await PromoCode.updateOne(
    { _id: booking.promo.promoId, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } }
  );
  return true;
}

/** Removes the code from a booking. */
async function removeCode({ bookingId, driverId, role }) {
  const { booking } = await loadBooking(bookingId, driverId, role);
  if (!booking.promo?.code) throw ApiError.badRequest('No promo code is applied to this booking');

  const removed = booking.promo.code;
  await releaseRedemption(booking);
  await Booking.updateOne(
    { _id: booking._id },
    { $set: { promo: { code: null, promoId: null, discountPoisha: 0 } } }
  );

  return { bookingId: booking._id, removed, nextStep: 'REPRICE_BOOKING' };
}

/** Live partner campaigns, for the "available offers" strip. */
async function listActive({ propertyType } = {}) {
  const now = new Date();
  const match = {
    isActive: true,
    $and: [
      { $or: [{ validFrom: null }, { validFrom: { $lte: now } }] },
      { $or: [{ validTo: null }, { validTo: { $gte: now } }] },
    ],
  };
  if (propertyType) match.$and.push({ $or: [{ propertyType: null }, { propertyType }] });

  const codes = await PromoCode.find(match)
    .select('code partnerName description discountPoisha minSpendPoisha propertyType validTo usageLimit usedCount')
    .sort({ discountPoisha: -1 })
    .limit(20)
    .lean();

  return {
    items: codes.filter((c) => c.usageLimit === null || c.usedCount < c.usageLimit),
    total: codes.length,
  };
}

/* ------------------------------------------------------------------ admin */

async function listAll({ page = 1, limit = 20 }) {
  const [items, total] = await Promise.all([
    PromoCode.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    PromoCode.countDocuments(),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) || 1 };
}

async function createCode(payload, adminId) {
  try {
    return await PromoCode.create({ ...payload, createdBy: adminId });
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('A promo with that code already exists');
    throw err;
  }
}

async function updateCode(promoId, payload) {
  if (!mongoose.isValidObjectId(promoId)) throw ApiError.badRequest('That is not a valid promo id');

  const promo = await PromoCode.findByIdAndUpdate(promoId, { $set: payload }, { new: true, runValidators: true });
  if (!promo) throw ApiError.notFound('That promo code no longer exists');
  return promo;
}

module.exports = {
  evaluate,
  validateCode,
  applyCode,
  removeCode,
  listActive,
  listAll,
  createCode,
  updateCode,
  GLOBAL_CAP,
};
