/**
 * MALL HOURS CONTROLLER — OWNER: Tamal Deb Nath [TDN]
 */
const mongoose = require('mongoose');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { ok } = require('../../utils/apiResponse');
const service = require('./mallHours.service');
const { sweepOnce } = require('./mallHours.worker');

/** POST /api/mall-hours/check  { propertyId, startAt, endAt } */
const check = asyncHandler(async (req, res) => {
  const { propertyId, startAt, endAt } = req.body || {};
  const details = {};
  if (!propertyId || !mongoose.isValidObjectId(propertyId)) details.propertyId = 'A valid space id is required';
  if (!startAt || Number.isNaN(Date.parse(startAt))) details.startAt = 'A valid start time is required';
  if (!endAt || Number.isNaN(Date.parse(endAt))) details.endAt = 'A valid end time is required';
  if (!details.startAt && !details.endAt && new Date(endAt) <= new Date(startAt)) {
    details.endAt = 'End time must be after the start time';
  }
  if (Object.keys(details).length) throw ApiError.badRequest('Check the booking window', undefined, details);

  const start = new Date(startAt);
  const verdict = await service.checkBookingWindow(propertyId, start, new Date(endAt));

  return ok(
    res,
    {
      allowed: verdict.allowed,
      reason: verdict.reason,
      code: verdict.code,
      hours: verdict.hours,
      suggestion: verdict.allowed ? null : service.latestEndForDay(verdict.property, start),
    },
    verdict.allowed ? 'Within opening hours' : verdict.reason
  );
});

/** GET /api/mall-hours/property/:id — public, shown on the space detail page */
const getForProperty = asyncHandler(async (req, res) => {
  const { Property } = require('../../models');
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('That is not a valid space id');

  const property = await Property.findById(req.params.id)
    .select('title propertyType operatingHours')
    .lean();
  if (!property) throw ApiError.notFound('That space no longer exists');

  const h = property.operatingHours || {};
  return ok(res, {
    propertyId: property._id,
    title: property.title,
    propertyType: property.propertyType,
    operatingHours: h,
    guardApplies: property.propertyType === 'MALL' && !h.is24x7,
    display: h.is24x7
      ? 'Open 24/7'
      : `${service.minutesToLabel(h.openMinute ?? 0)} – ${service.minutesToLabel(h.closeMinute ?? 1440)}`,
  });
});

/** GET /api/mall-hours/my-properties — host's own spaces */
const myProperties = asyncHandler(async (req, res) =>
  ok(res, { items: await service.listHostProperties(req.userId) })
);

/** PATCH /api/mall-hours/property/:id  { is24x7, openMinute|opens, closeMinute|closes } */
const update = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('That is not a valid space id');
  const data = await service.updateOperatingHours(req.params.id, req.userId, req.body || {});
  return ok(res, data, 'Opening hours saved');
});

/** POST /api/mall-hours/sweep — admin: run the guard worker on demand */
const runSweep = asyncHandler(async (_req, res) => ok(res, await sweepOnce(), 'Sweep complete'));

module.exports = { check, getForProperty, myProperties, update, runSweep };
