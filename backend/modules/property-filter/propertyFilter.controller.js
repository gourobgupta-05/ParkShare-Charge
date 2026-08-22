/**
 * PROPERTY FILTER CONTROLLER — OWNER: Tamal Deb Nath [TDN]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const service = require('./propertyFilter.service');
const { parseListQuery } = require('./propertyFilter.validator');

/** GET /api/filter/properties?propertyType=MALL&page=1 */
const list = asyncHandler(async (req, res) => {
  const filters = parseListQuery(req.query);
  const data = await service.listProperties(filters);
  return ok(res, data, `${data.total} spaces matched`);
});

/** GET /api/filter/counts?lat=&lng=&radiusKm= — badges next to the toggle */
const counts = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusKm = Number(req.query.radiusKm);
  const data = await service.getCategoryCounts({ lat, lng, radiusKm });
  return ok(res, data);
});

/** GET /api/filter/options */
const options = asyncHandler(async (_req, res) => ok(res, await service.getFilterOptions()));

module.exports = { list, counts, options };
