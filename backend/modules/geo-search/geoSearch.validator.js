/**
 * GEO SEARCH VALIDATOR — OWNER: Tamal Deb Nath [TDN]
 * Normalises and range-checks query params before they reach the pipeline.
 * Everything returns typed values, so the service never parses strings.
 */
const ApiError = require('../../utils/ApiError');
const {
  PROPERTY_TYPE, CONNECTOR_TYPE, PLATFORM,
} = require('../../shared/constants');

const MIN_KM = PLATFORM.SEARCH_RADIUS_MIN_KM; // 1
const MAX_KM = PLATFORM.SEARCH_RADIUS_MAX_KM; // 5
const SORTS = ['distance', 'price_asc', 'price_desc', 'rating'];

const num = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const bool = (v) => (v === undefined || v === '' ? undefined : v === true || v === 'true' || v === '1');

/** Accepts 'Mall', 'mall', 'MALL', 'Residential' … → canonical enum or undefined. */
function normalisePropertyType(raw) {
  if (!raw || raw === 'ALL' || raw === 'all') return undefined;
  const key = String(raw).trim().toUpperCase();
  if (key === 'COMMERCIAL' || key === 'COMMERCIAL_MALL') return PROPERTY_TYPE.MALL;
  if (Object.values(PROPERTY_TYPE).includes(key)) return key;
  throw ApiError.badRequest(
    `propertyType must be one of: ${Object.values(PROPERTY_TYPE).join(', ')}`,
    undefined,
    { propertyType: 'Choose Residential or Mall' }
  );
}

function parseSearchQuery(q = {}) {
  const details = {};

  const lat = num(q.lat);
  const lng = num(q.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) details.lat = 'Latitude is required and must be between -90 and 90';
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) details.lng = 'Longitude is required and must be between -180 and 180';

  let radiusKm = num(q.radiusKm);
  if (radiusKm === undefined) radiusKm = 3;
  if (!Number.isFinite(radiusKm) || radiusKm < MIN_KM || radiusKm > MAX_KM) {
    details.radiusKm = `Radius must be between ${MIN_KM} and ${MAX_KM} km`;
  }

  const startAt = q.startAt ? new Date(q.startAt) : null;
  const endAt = q.endAt ? new Date(q.endAt) : null;
  if (q.startAt && Number.isNaN(startAt?.getTime())) details.startAt = 'Invalid start time';
  if (q.endAt && Number.isNaN(endAt?.getTime())) details.endAt = 'Invalid end time';
  if (startAt && endAt && endAt <= startAt) details.endAt = 'End time must be after the start time';
  if ((startAt && !endAt) || (endAt && !startAt)) {
    details.startAt = 'Provide both a start and an end time, or neither';
  }

  const connectorType = q.connectorType ? String(q.connectorType).toUpperCase() : undefined;
  if (connectorType && !Object.values(CONNECTOR_TYPE).includes(connectorType)) {
    details.connectorType = `Must be one of: ${Object.values(CONNECTOR_TYPE).join(', ')}`;
  }

  const sort = q.sort || 'distance';
  if (!SORTS.includes(sort)) details.sort = `Must be one of: ${SORTS.join(', ')}`;

  const maxPricePoisha = num(q.maxPricePoisha);
  if (maxPricePoisha !== undefined && (!Number.isInteger(maxPricePoisha) || maxPricePoisha < 0)) {
    details.maxPricePoisha = 'Must be a whole number of poisha (৳1 = 100)';
  }

  const minRating = num(q.minRating);
  if (minRating !== undefined && (minRating < 0 || minRating > 5)) {
    details.minRating = 'Must be between 0 and 5';
  }

  if (Object.keys(details).length) {
    throw ApiError.badRequest('Check your search filters', undefined, details);
  }

  return {
    lat,
    lng,
    radiusKm,
    propertyType: normalisePropertyType(q.propertyType),
    hasCharger: bool(q.hasCharger),
    connectorType,
    maxPricePoisha,
    minRating,
    amenities: q.amenities
      ? String(q.amenities).split(',').map((a) => a.trim().toUpperCase()).filter(Boolean)
      : undefined,
    startAt: startAt || undefined,
    endAt: endAt || undefined,
    sort,
    limit: Math.min(num(q.limit) || 50, 100),
    skip: num(q.skip) || 0,
  };
}

function parseViewportQuery(q = {}) {
  const swLat = num(q.swLat); const swLng = num(q.swLng);
  const neLat = num(q.neLat); const neLng = num(q.neLng);
  const details = {};
  [['swLat', swLat, 90], ['neLat', neLat, 90], ['swLng', swLng, 180], ['neLng', neLng, 180]].forEach(
    ([name, value, bound]) => {
      if (!Number.isFinite(value) || Math.abs(value) > bound) details[name] = `${name} is required and must be a valid coordinate`;
    }
  );
  if (Object.keys(details).length) throw ApiError.badRequest('Invalid map bounds', undefined, details);

  return {
    swLat, swLng, neLat, neLng,
    propertyType: normalisePropertyType(q.propertyType),
    limit: Math.min(num(q.limit) || 200, 400),
  };
}

module.exports = { parseSearchQuery, parseViewportQuery, normalisePropertyType, SORTS };
