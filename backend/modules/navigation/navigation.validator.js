/**
 * NAVIGATION VALIDATOR — OWNER: Maidul Islam [MI]
 */
const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');

const PROFILES = ['driving-traffic', 'driving', 'cycling', 'walking'];

function parseOrigin(source = {}) {
  const details = {};
  const lat = Number(source.lat ?? source.originLat);
  const lng = Number(source.lng ?? source.originLng);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    details.lat = 'A valid latitude is required';
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    details.lng = 'A valid longitude is required';
  }
  if (Object.keys(details).length) {
    throw ApiError.badRequest('Share your location to start navigation', undefined, details);
  }

  let profile = source.profile || process.env.NAV_PROFILE || 'driving-traffic';
  if (!PROFILES.includes(profile)) {
    throw ApiError.badRequest('Unknown routing profile', undefined, {
      profile: `Must be one of: ${PROFILES.join(', ')}`,
    });
  }

  return { lat, lng, profile };
}

function parseBookingId(id) {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest('That is not a valid booking id');
  }
  return id;
}

module.exports = { parseOrigin, parseBookingId, PROFILES };
