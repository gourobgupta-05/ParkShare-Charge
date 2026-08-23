/**
 * GEO SEARCH CONTROLLER — OWNER: Tamal Deb Nath [TDN]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const service = require('./geoSearch.service');
const { parseSearchQuery, parseViewportQuery } = require('./geoSearch.validator');
const { buildGeoSearchPipeline } = require('./geoPipeline.builder');

/** GET /api/geo/search?lat=&lng=&radiusKm=&propertyType=&startAt=&endAt= */
const search = asyncHandler(async (req, res) => {
  const filters = parseSearchQuery(req.query);

  // ?explain=1 returns the pipeline instead of running it — useful in the demo
  // and in the report when showing how $geoNear is composed.
  if (req.query.explain === '1') {
    return ok(res, { pipeline: buildGeoSearchPipeline(filters) }, 'Pipeline preview');
  }

  const data = await service.searchNearby(filters);
  return ok(res, data, `${data.summary.total} spaces within ${filters.radiusKm} km`);
});

/** GET /api/geo/viewport?swLat=&swLng=&neLat=&neLng= — pins while panning */
const viewport = asyncHandler(async (req, res) => {
  const bounds = parseViewportQuery(req.query);
  const data = await service.searchViewport(bounds);
  return ok(res, data, `${data.total} pins in view`);
});

/** GET /api/geo/properties/:id */
const detail = asyncHandler(async (req, res) => {
  const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
  const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
  const data = await service.getPropertyDetail(req.params.id, { lat, lng });
  return ok(res, data);
});

/** GET /api/geo/index-health */
const indexHealth = asyncHandler(async (_req, res) => ok(res, await service.checkGeoIndex()));

module.exports = { search, viewport, detail, indexHealth };
