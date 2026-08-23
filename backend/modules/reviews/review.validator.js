/**
 * REVIEW VALIDATOR — OWNER: Gourob Gupta [GG]
 */
const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');

const MIN_COMMENT = Number(process.env.REVIEW_MIN_LENGTH) || 10;
const ALLOWED_TAGS = [
  'EASY_ACCESS', 'TIGHT_SPACE', 'WELL_LIT', 'SECURE', 'CLEAN',
  'FAST_CHARGER', 'SLOW_CHARGER', 'GOOD_VALUE', 'HARD_TO_FIND', 'FRIENDLY_HOST',
];

const SUB_KEYS = ['accuracy', 'access', 'cleanliness', 'charging'];

function parseReviewBody(body = {}, { requireBooking = true } = {}) {
  const details = {};
  const { bookingId, rating, comment, tags, subRatings } = body;

  if (requireBooking && (!bookingId || !mongoose.isValidObjectId(bookingId))) {
    details.bookingId = 'A valid booking id is required';
  }

  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    details.rating = 'Give a star rating from 1 to 5';
  }

  const text = comment === undefined || comment === null ? '' : String(comment).trim();
  if (text.length && text.length < MIN_COMMENT) {
    details.comment = `Write at least ${MIN_COMMENT} characters, or leave it blank`;
  }
  if (text.length > 1000) details.comment = 'Keep the review under 1000 characters';

  let cleanTags = [];
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      details.tags = 'Tags must be a list';
    } else {
      cleanTags = tags.map((t) => String(t).toUpperCase().trim()).filter(Boolean);
      const unknown = cleanTags.filter((t) => !ALLOWED_TAGS.includes(t));
      if (unknown.length) details.tags = `Unknown tag: ${unknown[0]}`;
      if (cleanTags.length > 5) details.tags = 'Pick at most 5 tags';
    }
  }

  const cleanSubs = {};
  if (subRatings && typeof subRatings === 'object') {
    for (const key of SUB_KEYS) {
      const value = subRatings[key];
      if (value === undefined || value === null || value === '') continue;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        details[`subRatings.${key}`] = 'Use a score from 1 to 5';
      } else {
        cleanSubs[key] = n;
      }
    }
  }

  if (Object.keys(details).length) {
    throw ApiError.badRequest('Check your review', undefined, details);
  }

  return { bookingId, rating: score, comment: text, tags: cleanTags, subRatings: cleanSubs };
}

function parseListQuery(query = {}) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '10', 10), 1), 50);

  let minRating;
  if (query.minRating !== undefined && query.minRating !== '') {
    minRating = Number(query.minRating);
    if (!Number.isFinite(minRating) || minRating < 1 || minRating > 5) {
      throw ApiError.badRequest('Rating filter must be between 1 and 5');
    }
  }

  const sort = ['recent', 'highest', 'lowest'].includes(query.sort) ? query.sort : 'recent';
  return { page, limit, minRating, sort };
}

module.exports = { parseReviewBody, parseListQuery, ALLOWED_TAGS, MIN_COMMENT };
