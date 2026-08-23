/**
 * TARIFF CONTROLLER — OWNER: Gourob Gupta [GG]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const service = require('./tariff.service');
const v = require('./tariff.validator');

/** GET /api/tariff/rates — the slabs currently in force */
const rates = asyncHandler(async (_req, res) => {
  const data = await service.getActiveRates();
  return ok(res, data, `BERC rate set ${data.version}`);
});

/** POST /api/tariff/estimate  { propertyId, startAt, endAt, kwh?, promoDiscountPoisha? } */
const estimate = asyncHandler(async (req, res) => {
  const body = v.parseEstimateBody(req.body);
  return ok(res, await service.estimate(body), 'Estimate ready');
});

/** POST /api/tariff/price/:bookingId  { kwh? } — writes booking.pricing */
const priceBooking = asyncHandler(async (req, res) => {
  const kwh = req.body?.kwh === undefined ? undefined : Number(req.body.kwh);
  const data = await service.priceBooking({
    bookingId: req.params.bookingId,
    actorId: req.userId,
    role: req.user.role,
    kwh,
  });
  return ok(res, data, 'Price locked in for this booking');
});

/** POST /api/tariff/finalize/:bookingId — settle energy against measured kWh */
const finalize = asyncHandler(async (req, res) =>
  ok(res, await service.finalizeSession(req.params.bookingId), 'Session energy costed')
);

/* --------------------------------------------------------------- admin -- */

/** GET /api/tariff/admin/rates */
const listRateSets = asyncHandler(async (_req, res) => ok(res, await service.listRateSets()));

/** POST /api/tariff/admin/rates  { version, slabs, note? } */
const publishRateSet = asyncHandler(async (req, res) => {
  const body = v.parseSlabsBody(req.body);
  const data = await service.publishRateSet({ ...body, adminId: req.userId });
  return created(res, data, `Rate set ${data.version} is now active`);
});

/** PATCH /api/tariff/admin/multiplier  { tariffMultiplier } */
const setMultiplier = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.setMultiplier({ multiplier: req.body?.tariffMultiplier, adminId: req.userId }),
    'Tariff multiplier saved'
  )
);

module.exports = { rates, estimate, priceBooking, finalize, listRateSets, publishRateSet, setMultiplier };
