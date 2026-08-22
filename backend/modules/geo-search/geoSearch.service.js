/**
 * GEO SEARCH SERVICE — OWNER: Tamal Deb Nath [TDN]
 * Runs the $geoNear aggregation against the shared Property model.
 * No schema is defined here — Property already exists in backend/models.
 */
const mongoose = require('mongoose');
const { Property } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { buildGeoSearchPipeline, buildViewportPipeline } = require('./geoPipeline.builder');

/**
 * Main radius search. Returns pins ready for Mapbox plus a summary block the
 * UI uses for its "23 spaces within 3 km" line.
 */
async function searchNearby(filters) {
  const pipeline = buildGeoSearchPipeline(filters);
  const results = await Property.aggregate(pipeline).allowDiskUse(false);

  const prices = results.map((r) => r.pricePerHourPoisha).filter((p) => Number.isFinite(p));

  return {
    query: {
      centre: { lat: filters.lat, lng: filters.lng },
      radiusKm: filters.radiusKm,
      propertyType: filters.propertyType || 'ALL',
      window: filters.startAt ? { startAt: filters.startAt, endAt: filters.endAt } : null,
      sort: filters.sort,
    },
    summary: {
      total: results.length,
      residential: results.filter((r) => !r.isMall).length,
      mall: results.filter((r) => r.isMall).length,
      withCharger: results.filter((r) => r.hasCharger).length,
      nearestMeters: results.length ? results[0].distanceMeters : null,
      priceRangePoisha: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    },
    results,
  };
}

/** Cheap pin fetch while the user pans the map. */
async function searchViewport(bounds) {
  const results = await Property.aggregate(buildViewportPipeline(bounds));
  return { total: results.length, results };
}

/** Full detail for one pin, with distance from the driver if coords are given. */
async function getPropertyDetail(propertyId, { lat, lng } = {}) {
  if (!mongoose.isValidObjectId(propertyId)) {
    throw ApiError.badRequest('That is not a valid space id');
  }

  const property = await Property.findById(propertyId)
    .populate('hostId', 'name avgRating ratingCount propertyType businessName verificationStatus')
    .lean();

  if (!property) throw ApiError.notFound('That space no longer exists');
  if (!property.isPublished) throw ApiError.notFound('That space is not currently listed');

  let distanceMeters = null;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    distanceMeters = Math.round(haversineMeters(
      { lat, lng },
      { lat: property.location.coordinates[1], lng: property.location.coordinates[0] }
    ));
  }

  return {
    ...property,
    lng: property.location.coordinates[0],
    lat: property.location.coordinates[1],
    distanceMeters,
  };
}

/** Great-circle distance in metres. Used for single-document distance only. */
function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Diagnostic: confirms the 2dsphere index actually exists. Saves an hour of
 * confusion when a teammate's database was seeded before the index was added.
 */
async function checkGeoIndex() {
  const indexes = await Property.collection.indexes();
  const geo = indexes.find((i) => Object.values(i.key || {}).includes('2dsphere'));
  return {
    hasGeoIndex: Boolean(geo),
    indexName: geo?.name || null,
    hint: geo ? null : 'Run Property.syncIndexes() or restart the API to build the 2dsphere index',
  };
}

module.exports = { searchNearby, searchViewport, getPropertyDetail, checkGeoIndex, haversineMeters };
