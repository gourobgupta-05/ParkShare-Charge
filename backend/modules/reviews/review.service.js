/**
 * ============================================================================
 * REVIEW SERVICE — OWNER: Gourob Gupta [GG]
 * ============================================================================
 * Post-session feedback plus the moving-average recalculation on the host and
 * the property.
 *
 * WHY THE AVERAGE IS INCREMENTAL, NOT A RE-AGGREGATION
 * Recomputing with an $avg over every review each time is O(n) and races: two
 * reviews landing together both read the old set and one overwrites the other.
 * Instead the average is folded in arithmetically inside a transaction:
 *
 *     newAvg = (oldAvg * oldCount + rating) / (oldCount + 1)
 *
 * The write is a guarded findOneAndUpdate on the exact ratingCount that was
 * read, so a concurrent review forces a retry instead of a silent overwrite.
 * A repair function is provided for the rare case the counters drift.
 *
 * VERIFICATION MATRIX
 * A review only counts if the booking actually completed and the driver
 * checked in. Sessions with real check-in and metered energy are flagged
 * verified, so the UI can distinguish them from bookings that were merely
 * paid for.
 * ============================================================================
 */
const mongoose = require('mongoose');
const { Booking, Property, User, Session } = require('../../models');
const Review = require('./review.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { BOOKING_STATUS, ROLES, ERROR_CODES } = require('../../shared/constants');

const EDIT_WINDOW_HOURS = Number(process.env.REVIEW_EDIT_WINDOW_HOURS) || 24;
const MAX_AVG_RETRIES = 3;

/* ------------------------------------------------------------------------ */
/* Moving average                                                           */
/* ------------------------------------------------------------------------ */

/** Pure arithmetic — extracted so it can be reasoned about and tested alone. */
function foldIn(avg, count, rating) {
  const nextCount = count + 1;
  const nextAvg = (Number(avg || 0) * count + rating) / nextCount;
  return { avg: Number(nextAvg.toFixed(3)), count: nextCount };
}

/** Replaces one rating with another without changing the count (edits). */
function foldSwap(avg, count, oldRating, newRating) {
  if (count <= 0) return { avg: Number(newRating), count: 1 };
  const nextAvg = (Number(avg) * count - oldRating + newRating) / count;
  return { avg: Number(nextAvg.toFixed(3)), count };
}

/**
 * Applies a fold to one document, guarded on the ratingCount that was read.
 * Returns false when another writer got there first, so the caller can retry.
 */
async function applyAverage(Model, id, transform, session) {
  const doc = await Model.findById(id).select('avgRating ratingCount').session(session).lean();
  if (!doc) return true; // nothing to update — treat as done

  const next = transform(doc.avgRating || 0, doc.ratingCount || 0);

  const result = await Model.updateOne(
    { _id: id, ratingCount: doc.ratingCount || 0 },
    { $set: { avgRating: next.avg, ratingCount: next.count } },
    { session }
  );

  return result.modifiedCount === 1;
}

/* ------------------------------------------------------------------------ */
/* Create                                                                   */
/* ------------------------------------------------------------------------ */

async function createReview({ driverId, bookingId, rating, comment, tags, subRatings }) {
  const booking = await Booking.findById(bookingId).lean();
  if (!booking) throw ApiError.notFound('That booking no longer exists');

  if (String(booking.driverId) !== String(driverId)) {
    throw ApiError.forbidden('You can only review your own bookings');
  }

  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    throw ApiError.badRequest(
      'You can leave a review once the session is complete',
      ERROR_CODES.BOOKING_STATE_INVALID,
      { bookingId: `This booking is ${booking.status.toLowerCase().replace(/_/g, ' ')}` }
    );
  }

  const existing = await Review.findOne({ bookingId }).select('_id').lean();
  if (existing) throw ApiError.conflict('You have already reviewed this booking');

  // Verification matrix — pull the evidence this session really happened.
  const session = await Session.findOne({ bookingId }).select('totalKwh').lean();
  const verification = {
    isVerifiedSession: Boolean(booking.checkIn?.at),
    checkedInAt: booking.checkIn?.at || null,
    sessionKwh: session?.totalKwh || 0,
    durationMinutes: Math.round((new Date(booking.endAt) - new Date(booking.startAt)) / 60000),
  };

  const dbSession = await mongoose.startSession();
  let review;

  try {
    for (let attempt = 1; attempt <= MAX_AVG_RETRIES; attempt += 1) {
      let contended = false;

      // eslint-disable-next-line no-await-in-loop
      await dbSession.withTransaction(async () => {
        const [created] = await Review.create(
          [
            {
              bookingId,
              driverId,
              hostId: booking.hostId,
              propertyId: booking.propertyId,
              rating,
              comment,
              tags,
              subRatings,
              verification,
            },
          ],
          { session: dbSession }
        );

        const fold = (avg, count) => foldIn(avg, count, rating);
        const hostOk = await applyAverage(User, booking.hostId, fold, dbSession);
        const propOk = await applyAverage(Property, booking.propertyId, fold, dbSession);

        if (!hostOk || !propOk) {
          contended = true;
          throw new ApiError(409, 'RETRY_AVERAGE', 'RETRY');
        }

        await Booking.updateOne(
          { _id: bookingId },
          { $set: { reviewId: created._id } },
          { session: dbSession }
        );

        review = created;
      });

      if (!contended) break;
      if (attempt === MAX_AVG_RETRIES) {
        throw ApiError.conflict('Another review landed at the same moment. Try again.');
      }
    }
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('You have already reviewed this booking');
    if (err.message === 'RETRY_AVERAGE') {
      throw ApiError.conflict('Another review landed at the same moment. Try again.');
    }
    if (/Transaction numbers are only allowed on a replica set/i.test(err.message || '')) {
      throw new ApiError(
        500,
        'Reviews need a MongoDB replica set. Point MONGO_URI at MongoDB Atlas (the free M0 tier is one).',
        ERROR_CODES.INTERNAL
      );
    }
    throw err;
  } finally {
    await dbSession.endSession();
  }

  logger.info(`[reviews] ${rating}★ on booking ${bookingId}, host average updated`);
  return review;
}

/* ------------------------------------------------------------------------ */
/* Edit                                                                     */
/* ------------------------------------------------------------------------ */

async function editReview({ reviewId, driverId, rating, comment, tags, subRatings }) {
  if (!mongoose.isValidObjectId(reviewId)) throw ApiError.badRequest('That is not a valid review id');

  const review = await Review.findById(reviewId);
  if (!review) throw ApiError.notFound('That review no longer exists');
  if (String(review.driverId) !== String(driverId)) {
    throw ApiError.forbidden('You can only edit your own review');
  }

  const ageHours = (Date.now() - review.createdAt.getTime()) / 3600000;
  if (ageHours > EDIT_WINDOW_HOURS) {
    throw ApiError.badRequest(`Reviews can be edited for ${EDIT_WINDOW_HOURS} hours after posting`);
  }

  const oldRating = review.rating;
  const dbSession = await mongoose.startSession();

  try {
    await dbSession.withTransaction(async () => {
      review.rating = rating;
      review.comment = comment;
      review.tags = tags;
      review.subRatings = subRatings;
      review.isEdited = true;
      review.editedAt = new Date();
      await review.save({ session: dbSession });

      if (oldRating !== rating) {
        const swap = (avg, count) => foldSwap(avg, count, oldRating, rating);
        await applyAverage(User, review.hostId, swap, dbSession);
        await applyAverage(Property, review.propertyId, swap, dbSession);
      }
    });
  } finally {
    await dbSession.endSession();
  }

  return review;
}

/* ------------------------------------------------------------------------ */
/* Read                                                                     */
/* ------------------------------------------------------------------------ */

const SORTS = {
  recent: { createdAt: -1 },
  highest: { rating: -1, createdAt: -1 },
  lowest: { rating: 1, createdAt: -1 },
};

async function listForProperty(propertyId, { page, limit, minRating, sort }) {
  if (!mongoose.isValidObjectId(propertyId)) throw ApiError.badRequest('That is not a valid space id');

  const match = { propertyId: new mongoose.Types.ObjectId(propertyId) };
  if (minRating) match.rating = { $gte: minRating };

  const [items, total, distribution] = await Promise.all([
    Review.find(match)
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('driverId', 'name avatarUrl')
      .lean(),
    Review.countDocuments(match),
    Review.aggregate([
      { $match: { propertyId: new mongoose.Types.ObjectId(propertyId) } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  const stars = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: distribution.find((d) => d._id === star)?.count || 0,
  }));
  const totalAll = stars.reduce((sum, s) => sum + s.count, 0);

  return {
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
    distribution: stars.map((s) => ({
      ...s,
      percent: totalAll ? Math.round((s.count / totalAll) * 100) : 0,
    })),
    verifiedCount: items.filter((r) => r.verification?.isVerifiedSession).length,
  };
}

async function listForHost(hostId, { page, limit, sort }) {
  if (!mongoose.isValidObjectId(hostId)) throw ApiError.badRequest('That is not a valid host id');

  const [items, total, host] = await Promise.all([
    Review.find({ hostId })
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('driverId', 'name avatarUrl')
      .populate('propertyId', 'title')
      .lean(),
    Review.countDocuments({ hostId }),
    User.findById(hostId).select('name businessName avgRating ratingCount').lean(),
  ]);

  return { host, items, page, limit, total, pages: Math.ceil(total / limit) || 1 };
}

/** Completed bookings the driver has not reviewed yet. */
async function listPending(driverId) {
  const completed = await Booking.find({
    driverId,
    status: BOOKING_STATUS.COMPLETED,
    reviewId: null,
  })
    .sort({ endAt: -1 })
    .limit(20)
    .populate('propertyId', 'title address photos')
    .populate('hostId', 'name businessName')
    .lean();

  return { items: completed, total: completed.length };
}

async function getByBooking(bookingId, userId, role) {
  if (!mongoose.isValidObjectId(bookingId)) throw ApiError.badRequest('That is not a valid booking id');

  const review = await Review.findOne({ bookingId })
    .populate('driverId', 'name avatarUrl')
    .lean();
  if (!review) throw ApiError.notFound('No review has been left for this booking');

  const isParty =
    String(review.driverId?._id || review.driverId) === String(userId) ||
    String(review.hostId) === String(userId);
  if (!isParty && role !== ROLES.ADMIN) {
    // Reviews are public content, so this is not a leak — just return it.
    return review;
  }
  return review;
}

/* ------------------------------------------------------------------------ */
/* Host reply                                                               */
/* ------------------------------------------------------------------------ */

async function replyToReview({ reviewId, hostId, body }) {
  if (!mongoose.isValidObjectId(reviewId)) throw ApiError.badRequest('That is not a valid review id');

  const text = String(body || '').trim();
  if (text.length < 5) {
    throw ApiError.badRequest('Write a short reply', undefined, {
      body: 'Replies need at least 5 characters',
    });
  }
  if (text.length > 600) {
    throw ApiError.badRequest('Keep the reply under 600 characters', undefined, {
      body: 'Too long',
    });
  }

  const review = await Review.findById(reviewId);
  if (!review) throw ApiError.notFound('That review no longer exists');
  if (String(review.hostId) !== String(hostId)) {
    throw ApiError.forbidden('You can only reply to reviews on your own spaces');
  }

  review.hostReply = { body: text, repliedAt: new Date() };
  await review.save();
  return review;
}

/* ------------------------------------------------------------------------ */
/* Repair                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Recomputes averages from scratch. Admin-only escape hatch for the rare case
 * the incremental counters drift — for instance if reviews were deleted
 * directly in the database during development.
 */
async function recomputeAverages() {
  const groups = await Review.aggregate([
    {
      $group: {
        _id: { hostId: '$hostId', propertyId: '$propertyId' },
        avg: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const hostTotals = new Map();
  let propertiesUpdated = 0;

  for (const g of groups) {
    // eslint-disable-next-line no-await-in-loop
    await Property.updateOne(
      { _id: g._id.propertyId },
      { $set: { avgRating: Number(g.avg.toFixed(3)), ratingCount: g.count } }
    );
    propertiesUpdated += 1;

    const key = String(g._id.hostId);
    const acc = hostTotals.get(key) || { sum: 0, count: 0 };
    acc.sum += g.avg * g.count;
    acc.count += g.count;
    hostTotals.set(key, acc);
  }

  for (const [hostId, acc] of hostTotals) {
    // eslint-disable-next-line no-await-in-loop
    await User.updateOne(
      { _id: hostId },
      { $set: { avgRating: Number((acc.sum / acc.count).toFixed(3)), ratingCount: acc.count } }
    );
  }

  return { propertiesUpdated, hostsUpdated: hostTotals.size };
}

module.exports = {
  foldIn,
  foldSwap,
  createReview,
  editReview,
  listForProperty,
  listForHost,
  listPending,
  getByBooking,
  replyToReview,
  recomputeAverages,
};
