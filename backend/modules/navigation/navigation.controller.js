/**
 * NAVIGATION CONTROLLER — OWNER: Maidul Islam [MI]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const service = require('./navigation.service');
const v = require('./navigation.validator');

/** GET /api/navigation/provider — is routing real or simulated? */
const provider = asyncHandler(async (_req, res) => ok(res, service.providerStatus()));

/** GET /api/navigation/destination/:bookingId */
const destination = asyncHandler(async (req, res) => {
  const bookingId = v.parseBookingId(req.params.bookingId);
  const data = await service.getDestination({ bookingId, userId: req.userId, role: req.user.role });
  return ok(res, data);
});

/** POST /api/navigation/route/:bookingId  { lat, lng, profile? } */
const startRoute = asyncHandler(async (req, res) => {
  const bookingId = v.parseBookingId(req.params.bookingId);
  const origin = v.parseOrigin(req.body);
  const data = await service.startRoute({ bookingId, userId: req.userId, role: req.user.role, origin });
  return ok(res, data, `Route ready · ${Math.round(data.etaSeconds / 60)} min to the entrance`);
});

/** GET /api/navigation/eta/:bookingId?lat=&lng= */
const eta = asyncHandler(async (req, res) => {
  const bookingId = v.parseBookingId(req.params.bookingId);
  const origin = v.parseOrigin(req.query);
  const data = await service.refreshEta({ bookingId, userId: req.userId, role: req.user.role, origin });
  return ok(res, data, data.hasArrived ? 'You have arrived' : 'ETA updated');
});

/** POST /api/navigation/stop/:bookingId */
const stopRoute = asyncHandler(async (req, res) => {
  const bookingId = v.parseBookingId(req.params.bookingId);
  const data = await service.stopRoute({ bookingId, userId: req.userId, role: req.user.role });
  return ok(res, data, 'Navigation stopped');
});

module.exports = { provider, destination, startRoute, eta, stopRoute };
