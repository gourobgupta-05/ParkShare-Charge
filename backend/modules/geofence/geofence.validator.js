/**
 * GEOFENCE VALIDATOR — OWNER: S. Moontaha Rahman [SMR]
 */
const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');

function parseBookingId(id) {
  if (!id || !mongoose.isValidObjectId(id)) throw ApiError.badRequest('That is not a valid booking id');
  return id;
}

/** Coordinates from a device ping. Accuracy is optional but respected. */
function parseCoords(source = {}, { required = true } = {}) {
  const lat = Number(source.lat ?? source.latitude);
  const lng = Number(source.lng ?? source.longitude);

  if (!required && !Number.isFinite(lat) && !Number.isFinite(lng)) return null;

  const details = {};
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) details.lat = 'A valid latitude is required';
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) details.lng = 'A valid longitude is required';
  if (Object.keys(details).length) {
    throw ApiError.badRequest('Share your location to check in', undefined, details);
  }

  const accuracy = Number(source.accuracy);
  return {
    lat,
    lng,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : undefined,
    isMock: Boolean(source.isMock),
  };
}

module.exports = { parseBookingId, parseCoords };
