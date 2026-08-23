/**
 * REVIEW CONTROLLER — OWNER: Gourob Gupta [GG]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const service = require('./review.service');
const v = require('./review.validator');

/** POST /api/reviews  { bookingId, rating, comment?, tags?, subRatings? } */
const create = asyncHandler(async (req, res) => {
  const body = v.parseReviewBody(req.body);
  const review = await service.createReview({ driverId: req.userId, ...body });
  return created(res, review, 'Thanks — your review is live');
});

/** PATCH /api/reviews/:id */
const edit = asyncHandler(async (req, res) => {
  const body = v.parseReviewBody(req.body, { requireBooking: false });
  const review = await service.editReview({ reviewId: req.params.id, driverId: req.userId, ...body });
  return ok(res, review, 'Review updated');
});

/** GET /api/reviews/property/:propertyId */
const listForProperty = asyncHandler(async (req, res) => {
  const q = v.parseListQuery(req.query);
  const data = await service.listForProperty(req.params.propertyId, q);
  return ok(res, data, `${data.total} review${data.total === 1 ? '' : 's'}`);
});

/** GET /api/reviews/host/:hostId */
const listForHost = asyncHandler(async (req, res) => {
  const q = v.parseListQuery(req.query);
  return ok(res, await service.listForHost(req.params.hostId, q));
});

/** GET /api/reviews/pending — completed bookings awaiting a review */
const listPending = asyncHandler(async (req, res) =>
  ok(res, await service.listPending(req.userId))
);

/** GET /api/reviews/booking/:bookingId */
const getByBooking = asyncHandler(async (req, res) =>
  ok(res, await service.getByBooking(req.params.bookingId, req.userId, req.user?.role))
);

/** GET /api/reviews/tags — the allowed tag vocabulary */
const tags = asyncHandler(async (_req, res) =>
  ok(res, { tags: v.ALLOWED_TAGS, minCommentLength: v.MIN_COMMENT })
);

/** POST /api/reviews/:id/reply  { body } */
const reply = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.replyToReview({ reviewId: req.params.id, hostId: req.userId, body: req.body?.body }),
    'Reply posted'
  )
);

/** POST /api/reviews/recompute — admin repair */
const recompute = asyncHandler(async (_req, res) =>
  ok(res, await service.recomputeAverages(), 'Averages rebuilt from source reviews')
);

module.exports = { create, edit, listForProperty, listForHost, listPending, getByBooking, tags, reply, recompute };
