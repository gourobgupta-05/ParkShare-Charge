/**
 * MALL HOURS GUARD MIDDLEWARE — OWNER: Tamal Deb Nath [TDN]
 *
 * Drop this in front of any route that creates or extends a booking:
 *
 *   const { mallHoursGuard } = require('../mall-hours/mallHoursGuard.middleware');
 *   router.post('/bookings', authenticate, mallHoursGuard(), controller.create);
 *
 * It reads propertyId / startAt / endAt from the body (configurable), rejects
 * with 400 + OUTSIDE_MALL_HOURS when the window breaches closing time, and on
 * success attaches `req.mallHoursCheck` so the caller can persist the audit
 * trail into `booking.mallHoursCheck` (that field is [TDN]-owned).
 */
const ApiError = require('../../utils/ApiError');
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./mallHours.service');

function mallHoursGuard(options = {}) {
  const {
    propertyIdField = 'propertyId',
    startField = 'startAt',
    endField = 'endAt',
    source = 'body',
  } = options;

  return asyncHandler(async (req, _res, next) => {
    const data = req[source] || {};
    const propertyId = data[propertyIdField];
    const startAt = data[startField];
    const endAt = data[endField];

    // Nothing to check — let the route's own validator complain about it.
    if (!propertyId || !startAt || !endAt) return next();

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return next();

    const verdict = await service.checkBookingWindow(propertyId, start, end);

    if (!verdict.allowed) {
      const suggestion = service.latestEndForDay(verdict.property, start);
      throw ApiError.badRequest(verdict.reason, verdict.code, {
        endAt: verdict.reason,
        operatingHours: verdict.hours,
        ...(suggestion ? { suggestion } : {}),
      });
    }

    req.mallHoursCheck = { passed: true, checkedAt: new Date(), reason: null };
    return next();
  });
}

module.exports = { mallHoursGuard };
