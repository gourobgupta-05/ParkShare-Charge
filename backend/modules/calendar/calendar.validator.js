/**
 * CALENDAR VALIDATOR — OWNER: Gourob Gupta [GG]
 * Parses and range-checks input before it reaches the service, so the service
 * only ever sees typed values.
 */
const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');
const { BOOKING_STATUS } = require('../../shared/constants');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseBookingBody(body = {}) {
  const details = {};
  const { propertyId, startAt, endAt } = body;

  if (!propertyId || !mongoose.isValidObjectId(propertyId)) {
    details.propertyId = 'A valid space id is required';
  }
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (!startAt || Number.isNaN(start.getTime())) details.startAt = 'A valid start time is required';
  if (!endAt || Number.isNaN(end.getTime())) details.endAt = 'A valid end time is required';

  if (Object.keys(details).length) {
    throw ApiError.badRequest('Check the booking details', undefined, details);
  }
  return { propertyId, startAt: start, endAt: end };
}

function parseDayQuery(query = {}) {
  const date = query.date;
  if (!DATE_RE.test(String(date || ''))) {
    throw ApiError.badRequest('Provide a date as YYYY-MM-DD', undefined, {
      date: 'Use the format 2026-08-25',
    });
  }
  return { date };
}

function parseRangeQuery(query = {}) {
  const { from, to } = query;
  const details = {};
  if (!DATE_RE.test(String(from || ''))) details.from = 'Use the format 2026-08-25';
  if (!DATE_RE.test(String(to || ''))) details.to = 'Use the format 2026-08-25';
  if (Object.keys(details).length) throw ApiError.badRequest('Check the date range', undefined, details);
  return { from, to };
}

function parseListQuery(query = {}) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 50);

  let status;
  if (query.status) {
    status = String(query.status).toUpperCase();
    if (!Object.values(BOOKING_STATUS).includes(status)) {
      throw ApiError.badRequest('Unknown booking status', undefined, {
        status: `Must be one of: ${Object.values(BOOKING_STATUS).join(', ')}`,
      });
    }
  }

  const scope = ['driver', 'host', 'all'].includes(query.scope) ? query.scope : 'driver';
  return { page, limit, status, scope };
}

function parseAvailabilityBody(body = {}) {
  if (body.rules === undefined && body.blackoutDates === undefined) {
    throw ApiError.badRequest('Send rules, blackoutDates, or both');
  }
  return { rules: body.rules, blackoutDates: body.blackoutDates };
}

module.exports = {
  parseBookingBody,
  parseDayQuery,
  parseRangeQuery,
  parseListQuery,
  parseAvailabilityBody,
};
