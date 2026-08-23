/**
 * ============================================================================
 * CALENDAR SERVICE — OWNER: Gourob Gupta [GG]
 * ============================================================================
 * Availability from the property's embedded weekly rules, and booking creation
 * protected by transactional slot locks.
 *
 * Booking fields written here are only the ones [GG] owns:
 *   driverId, hostId, propertyId, startAt, endAt, status (initial)
 * Pricing is filled by the tariff module (also [GG]); escrow, navigation,
 * check-in, settlement and review blocks belong to other members.
 * ============================================================================
 */
const mongoose = require('mongoose');
const { Booking, Property, User } = require('../../models');
const SlotLock = require('./slotLock.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const {
  BOOKING_STATUS, BLOCKING_STATUSES, VERIFICATION_STATUS,
  PLATFORM, ERROR_CODES, ROLES,
} = require('../../shared/constants');
const T = require('./dhakaTime.util');

/** Grid size. Every booking must start and end on a multiple of this. */
const SLOT_MINUTES = Number(process.env.CALENDAR_SLOT_MINUTES) || 30;
const SLOT_MS = SLOT_MINUTES * 60000;
const LOCK_GRACE_MS = 60 * 60 * 1000; // keep locks an hour past the session end

/* ------------------------------------------------------------------------ */
/* Availability                                                             */
/* ------------------------------------------------------------------------ */

/**
 * Slot grid for one Dhaka calendar day, marked free or busy.
 * Busy comes from any booking in a BLOCKING status that overlaps the slot.
 */
async function getDayAvailability(propertyId, dateString) {
  if (!mongoose.isValidObjectId(propertyId)) {
    throw ApiError.badRequest('That is not a valid space id');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ''))) {
    throw ApiError.badRequest('Provide a date as YYYY-MM-DD', undefined, {
      date: 'Use the format 2026-08-25',
    });
  }

  const property = await Property.findById(propertyId)
    .select('title propertyType availability blackoutDates operatingHours pricePerHourPoisha hasCharger isPublished')
    .lean();
  if (!property) throw ApiError.notFound('That space no longer exists');

  const dayStartUtc = T.dhakaToUtc(dateString, 0);
  const dayEndUtc = T.dhakaToUtc(dateString, 1440);
  const dayOfWeek = T.toDhakaDayOfWeek(new Date(dayStartUtc.getTime() + 60000));

  const blackout = T.isBlackout(dayStartUtc, property.blackoutDates);

  // Weekly rules for this weekday. No rules at all = host hasn't opened the
  // calendar yet, which is different from "fully booked" and says so in the UI.
  const rules = (property.availability || []).filter((r) => r.dayOfWeek === dayOfWeek);

  const existing = await Booking.find({
    propertyId,
    status: { $in: BLOCKING_STATUSES },
    startAt: { $lt: dayEndUtc },
    endAt: { $gt: dayStartUtc },
  })
    .select('startAt endAt status')
    .lean();

  const isBusy = (slotStart, slotEnd) =>
    existing.some((b) => b.startAt < slotEnd && b.endAt > slotStart);

  const slots = [];
  const now = new Date();

  for (const rule of rules) {
    const from = Math.max(0, Math.min(rule.startMinute, 1440));
    const to = Math.max(from, Math.min(rule.endMinute, 1440));

    for (let minute = from; minute + SLOT_MINUTES <= to; minute += SLOT_MINUTES) {
      const slotStart = T.dhakaToUtc(dateString, minute);
      const slotEnd = new Date(slotStart.getTime() + SLOT_MS);

      const past = slotEnd <= now;
      const busy = isBusy(slotStart, slotEnd);

      slots.push({
        startAt: slotStart,
        endAt: slotEnd,
        label: T.minutesToLabel(minute),
        endLabel: T.minutesToLabel(minute + SLOT_MINUTES),
        isAvailable: !busy && !past && !blackout,
        reason: blackout ? 'BLACKOUT' : past ? 'PAST' : busy ? 'BOOKED' : null,
      });
    }
  }

  return {
    propertyId,
    title: property.title,
    propertyType: property.propertyType,
    date: dateString,
    dayOfWeek,
    slotMinutes: SLOT_MINUTES,
    pricePerHourPoisha: property.pricePerHourPoisha,
    hasCharger: property.hasCharger,
    isBlackout: blackout,
    hasRules: rules.length > 0,
    operatingHours: property.operatingHours,
    summary: {
      total: slots.length,
      available: slots.filter((s) => s.isAvailable).length,
      booked: slots.filter((s) => s.reason === 'BOOKED').length,
    },
    slots,
  };
}

/** Compact free/busy counts across a date range — drives the month view. */
async function getRangeSummary(propertyId, fromDate, toDate) {
  const days = [];
  const start = T.dhakaToUtc(fromDate, 0);
  const end = T.dhakaToUtc(toDate, 0);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw ApiError.badRequest('Provide from and to dates as YYYY-MM-DD');
  }
  const dayCount = Math.round((end - start) / 86400000) + 1;
  if (dayCount < 1 || dayCount > 31) {
    throw ApiError.badRequest('Ask for between 1 and 31 days at a time', undefined, {
      to: 'Range is too wide',
    });
  }

  for (let i = 0; i < dayCount; i += 1) {
    const dateString = T.toDhakaDateString(new Date(start.getTime() + i * 86400000 + 60000));
    // eslint-disable-next-line no-await-in-loop
    const day = await getDayAvailability(propertyId, dateString);
    days.push({
      date: dateString,
      available: day.summary.available,
      total: day.summary.total,
      isBlackout: day.isBlackout,
      hasRules: day.hasRules,
    });
  }

  return { propertyId, from: fromDate, to: toDate, days };
}

/* ------------------------------------------------------------------------ */
/* Validation helpers                                                       */
/* ------------------------------------------------------------------------ */

const isAligned = (date) => date.getTime() % SLOT_MS === 0;

/** Every grid slot the window covers. */
function slotsBetween(startAt, endAt) {
  const out = [];
  for (let t = startAt.getTime(); t < endAt.getTime(); t += SLOT_MS) out.push(new Date(t));
  return out;
}

/** Does the window sit entirely inside the host's weekly rules? */
function withinWeeklyRules(property, startAt, endAt) {
  const rules = property.availability || [];
  if (!rules.length) {
    return { ok: false, reason: 'This host has not opened their calendar yet' };
  }

  // Walk slot by slot so a window spanning two rules still validates.
  for (const slotStart of slotsBetween(startAt, endAt)) {
    const day = T.toDhakaDayOfWeek(slotStart);
    const minute = T.toDhakaMinutes(slotStart);
    const covered = rules.some(
      (r) => r.dayOfWeek === day && minute >= r.startMinute && minute + SLOT_MINUTES <= r.endMinute
    );
    if (!covered) {
      return {
        ok: false,
        reason: `The host is not available at ${T.minutesToLabel(minute)} on that day`,
      };
    }
  }
  return { ok: true };
}

/* ------------------------------------------------------------------------ */
/* Booking creation                                                         */
/* ------------------------------------------------------------------------ */

/**
 * Creates a PENDING_PAYMENT booking and locks every slot it covers.
 *
 * @param {object} p
 * @param {string} p.driverId
 * @param {string} p.propertyId
 * @param {Date}   p.startAt
 * @param {Date}   p.endAt
 * @param {object} [p.mallHoursCheck] - set by [TDN]'s guard middleware
 */
async function createBooking({ driverId, propertyId, startAt, endAt, mallHoursCheck }) {
  /* --------------------------------------------------- pre-flight checks -- */
  const now = new Date();
  const minutes = Math.round((endAt - startAt) / 60000);

  const details = {};
  if (endAt <= startAt) details.endAt = 'End time must be after the start time';
  if (startAt < now) details.startAt = 'Choose a time in the future';
  if (minutes < PLATFORM.MIN_BOOKING_MINUTES) {
    details.endAt = `Bookings run for at least ${PLATFORM.MIN_BOOKING_MINUTES} minutes`;
  }
  if (minutes > PLATFORM.MAX_BOOKING_HOURS * 60) {
    details.endAt = `Bookings run for at most ${PLATFORM.MAX_BOOKING_HOURS} hours`;
  }
  if (!isAligned(startAt) || !isAligned(endAt)) {
    details.startAt = `Times must fall on ${SLOT_MINUTES}-minute boundaries`;
  }
  if (Object.keys(details).length) {
    throw ApiError.badRequest('Check the booking times', undefined, details);
  }

  const property = await Property.findById(propertyId).lean();
  if (!property) throw ApiError.notFound('That space no longer exists');
  if (!property.isPublished) throw ApiError.badRequest('That space is not accepting bookings');

  const host = await User.findById(property.hostId).select('role verificationStatus').lean();
  if (!host || host.role !== ROLES.HOST) throw ApiError.badRequest('That space has no active host');
  if (host.verificationStatus !== VERIFICATION_STATUS.APPROVED) {
    throw ApiError.badRequest(
      'This host is still being verified and cannot take bookings yet',
      ERROR_CODES.HOST_NOT_VERIFIED
    );
  }

  if (T.isBlackout(startAt, property.blackoutDates)) {
    throw ApiError.badRequest('The host has blocked that date', undefined, {
      startAt: 'Pick another day',
    });
  }

  const rulesCheck = withinWeeklyRules(property, startAt, endAt);
  if (!rulesCheck.ok) {
    throw ApiError.badRequest(rulesCheck.reason, undefined, { startAt: rulesCheck.reason });
  }

  // Cheap pre-check. The real guarantee is the unique index below, but this
  // returns a friendlier error for the overwhelmingly common case.
  const clash = await Booking.findOne({
    propertyId,
    status: { $in: BLOCKING_STATUSES },
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
  })
    .select('_id')
    .lean();
  if (clash) {
    throw ApiError.conflict('Someone just booked that slot. Pick another time.', ERROR_CODES.SLOT_ALREADY_BOOKED);
  }

  /* ------------------------------------------------------- transaction --- */
  const session = await mongoose.startSession();
  let created;

  try {
    await session.withTransaction(async () => {
      const [booking] = await Booking.create(
        [
          {
            driverId,
            hostId: property.hostId,
            propertyId,
            startAt,
            endAt,
            status: BOOKING_STATUS.PENDING_PAYMENT,
            mallHoursCheck: mallHoursCheck || undefined,
          },
        ],
        { session }
      );

      const expiresAt = new Date(endAt.getTime() + LOCK_GRACE_MS);
      const locks = slotsBetween(startAt, endAt).map((slotStart) => ({
        propertyId,
        slotStart,
        bookingId: booking._id,
        driverId,
        expiresAt,
      }));

      // ordered:true so the first collision aborts immediately.
      await SlotLock.insertMany(locks, { session, ordered: true });

      created = booking;
    });
  } catch (err) {
    if (err.code === 11000) {
      throw ApiError.conflict(
        'Someone just booked one of those slots. Pick another time.',
        ERROR_CODES.SLOT_ALREADY_BOOKED
      );
    }
    if (/Transaction numbers are only allowed on a replica set/i.test(err.message || '')) {
      throw new ApiError(
        500,
        'Slot locking needs a MongoDB replica set. Point MONGO_URI at MongoDB Atlas (the free M0 tier is one).',
        ERROR_CODES.INTERNAL
      );
    }
    throw err;
  } finally {
    await session.endSession();
  }

  logger.info(`[calendar] booking ${created._id} held ${minutes} min on ${property.title}`);
  return created;
}

/* ------------------------------------------------------------------------ */
/* Cancellation & listing                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Cancels an unpaid booking and frees its locks.
 * Paid bookings go through [TDN]'s escrow refund instead — this refuses them
 * rather than silently leaving money stranded in escrow.
 */
async function cancelPending({ bookingId, actorId, isAdmin = false }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('That booking no longer exists');

  const isParty =
    String(booking.driverId) === String(actorId) || String(booking.hostId) === String(actorId);
  if (!isParty && !isAdmin) throw ApiError.forbidden('You are not a party to this booking');

  if (booking.status !== BOOKING_STATUS.PENDING_PAYMENT) {
    throw ApiError.conflict(
      'This booking is already paid for. Cancel it from your bookings list so the refund runs.',
      ERROR_CODES.BOOKING_STATE_INVALID
    );
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      booking.transitionTo(BOOKING_STATUS.CANCELLED);
      booking.cancelledReason = 'Cancelled before payment';
      await booking.save({ session });
      await SlotLock.deleteMany({ bookingId: booking._id }, { session });
    });
  } finally {
    await session.endSession();
  }

  return { bookingId: booking._id, status: booking.status };
}

async function listBookings({ userId, role, scope = 'driver', status, page = 1, limit = 20 }) {
  const match = scope === 'host' ? { hostId: userId } : { driverId: userId };
  if (role === ROLES.ADMIN && scope === 'all') delete match.hostId;
  if (status) match.status = status;

  const [items, total] = await Promise.all([
    Booking.find(match)
      .sort({ startAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('propertyId', 'title address propertyType photos pricePerHourPoisha hasCharger')
      .populate(scope === 'host' ? 'driverId' : 'hostId', 'name businessName avgRating')
      .lean(),
    Booking.countDocuments(match),
  ]);

  return { items, page, limit, total, pages: Math.ceil(total / limit) || 1 };
}

async function getBooking(bookingId, userId, role) {
  if (!mongoose.isValidObjectId(bookingId)) throw ApiError.badRequest('That is not a valid booking id');

  const booking = await Booking.findById(bookingId)
    .populate('propertyId', 'title address propertyType operatingHours pricePerHourPoisha chargerSpec hasCharger location')
    .populate('hostId', 'name businessName avgRating ratingCount')
    .lean();
  if (!booking) throw ApiError.notFound('That booking no longer exists');

  const isParty =
    String(booking.driverId) === String(userId) || String(booking.hostId?._id || booking.hostId) === String(userId);
  if (!isParty && role !== ROLES.ADMIN) throw ApiError.forbidden('You are not a party to this booking');

  return booking;
}

/* ------------------------------------------------------------------------ */
/* Host availability rules                                                  */
/* ------------------------------------------------------------------------ */

/** Replaces the weekly rules and blackout dates on one of the host's spaces. */
async function setAvailability({ propertyId, hostId, isAdmin, rules, blackoutDates }) {
  const property = await Property.findById(propertyId);
  if (!property) throw ApiError.notFound('That space no longer exists');
  if (String(property.hostId) !== String(hostId) && !isAdmin) {
    throw ApiError.forbidden('You can only edit the calendar on your own spaces');
  }

  if (rules !== undefined) {
    if (!Array.isArray(rules)) throw ApiError.badRequest('Availability rules must be a list');
    if (rules.length > 40) throw ApiError.badRequest('That is too many availability rules');

    const cleaned = rules.map((r, i) => {
      const dayOfWeek = Number(r.dayOfWeek);
      const startMinute = T.labelToMinutes(r.startMinute ?? r.start);
      const endMinute = T.labelToMinutes(r.endMinute ?? r.end);

      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        throw ApiError.badRequest('Each rule needs a weekday between 0 and 6', undefined, {
          [`rules.${i}.dayOfWeek`]: 'Use 0 for Sunday through 6 for Saturday',
        });
      }
      if (startMinute === null || endMinute === null || endMinute <= startMinute) {
        throw ApiError.badRequest('Each rule needs a start before its end', undefined, {
          [`rules.${i}.endMinute`]: 'End time must be after the start time',
        });
      }
      if (startMinute % SLOT_MINUTES || endMinute % SLOT_MINUTES) {
        throw ApiError.badRequest(`Times must fall on ${SLOT_MINUTES}-minute boundaries`, undefined, {
          [`rules.${i}.startMinute`]: `Use ${SLOT_MINUTES}-minute steps`,
        });
      }
      return { dayOfWeek, startMinute, endMinute };
    });

    // Overlapping rules on the same weekday would double-count slots.
    const byDay = new Map();
    for (const r of cleaned) {
      const list = byDay.get(r.dayOfWeek) || [];
      if (list.some((o) => r.startMinute < o.endMinute && r.endMinute > o.startMinute)) {
        throw ApiError.badRequest('Two rules on the same day overlap', undefined, {
          rules: 'Merge the overlapping windows',
        });
      }
      list.push(r);
      byDay.set(r.dayOfWeek, list);
    }

    property.availability = cleaned;
  }

  if (blackoutDates !== undefined) {
    if (!Array.isArray(blackoutDates)) throw ApiError.badRequest('Blackout dates must be a list');
    const parsed = blackoutDates.map((d) => new Date(d));
    if (parsed.some((d) => Number.isNaN(d.getTime()))) {
      throw ApiError.badRequest('One of the blackout dates is not a valid date');
    }
    property.blackoutDates = parsed;
  }

  await property.save();

  return {
    propertyId: property._id,
    title: property.title,
    availability: property.availability,
    blackoutDates: property.blackoutDates,
  };
}

/** The host's spaces plus their current rules, for the availability editor. */
async function listHostCalendars(hostId) {
  const properties = await Property.find({ hostId })
    .select('title propertyType availability blackoutDates isPublished pricePerHourPoisha')
    .sort({ createdAt: -1 })
    .lean();

  return properties.map((p) => ({
    ...p,
    ruleCount: (p.availability || []).length,
    openHoursPerWeek:
      (p.availability || []).reduce((sum, r) => sum + (r.endMinute - r.startMinute), 0) / 60,
  }));
}

module.exports = {
  SLOT_MINUTES,
  getDayAvailability,
  getRangeSummary,
  createBooking,
  cancelPending,
  listBookings,
  getBooking,
  setAvailability,
  listHostCalendars,
  slotsBetween,
  withinWeeklyRules,
};
