/**
 * GEOFENCE CONTROLLER — OWNER: S. Moontaha Rahman [SMR]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const service = require('./geofence.service');
const passes = require('./entryPass.service');
const v = require('./geofence.validator');

/** GET /api/geofence/target/:bookingId */
const target = asyncHandler(async (req, res) => {
  const bookingId = v.parseBookingId(req.params.bookingId);
  return ok(res, await service.getTarget({ bookingId, userId: req.userId, role: req.user.role }));
});

/** POST /api/geofence/ping/:bookingId  { lat, lng, accuracy? } */
const ping = asyncHandler(async (req, res) => {
  const bookingId = v.parseBookingId(req.params.bookingId);
  const coords = v.parseCoords(req.body);
  const data = await service.ping({ bookingId, userId: req.userId, role: req.user.role, coords });

  const message = data.justCheckedIn
    ? 'Checked in — your session is now active'
    : data.checkedIn
      ? 'Already checked in'
      : data.reason || `${data.distanceMeters} m from the entrance`;

  return ok(res, data, message);
});

/** POST /api/geofence/checkin/:bookingId  { lat?, lng? } */
const manualCheckIn = asyncHandler(async (req, res) => {
  const bookingId = v.parseBookingId(req.params.bookingId);
  const coords = v.parseCoords(req.body, { required: false });
  const data = await service.manualCheckIn({ bookingId, userId: req.userId, role: req.user.role, coords });
  return ok(res, data, data.alreadyCheckedIn ? 'Already checked in' : 'Checked in');
});

/** GET /api/geofence/pass/:bookingId */
const issuePass = asyncHandler(async (req, res) => {
  const bookingId = v.parseBookingId(req.params.bookingId);
  const data = await passes.issuePass({ bookingId, userId: req.userId, role: req.user.role });
  return ok(res, data, `Show this pass at the entrance — valid for ${data.expiresInMinutes} minutes`);
});

/** POST /api/geofence/pass/verify  { token } */
const verifyPass = asyncHandler(async (req, res) => {
  const data = await passes.verifyPass({
    token: req.body?.token,
    scannerId: req.userId,
    role: req.user.role,
  });
  return ok(res, data, data.alreadyCheckedIn ? 'Already checked in' : 'Pass accepted — driver checked in');
});

module.exports = { target, ping, manualCheckIn, issuePass, verifyPass };
