/**
 * PROMO CONTROLLER — OWNER: Maidul Islam [MI]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const { formatPoisha } = require('../../utils/money');
const service = require('./promo.service');
const v = require('./promo.validator');

/** POST /api/promo/validate  { code, bookingId } — dry run, claims nothing */
const validate = asyncHandler(async (req, res) => {
  const { code, bookingId } = v.parseApplyBody(req.body);
  const data = await service.validateCode({ code, bookingId, driverId: req.userId, role: req.user.role });
  return ok(res, data, data.valid ? `${formatPoisha(data.discountPoisha)} off` : data.reason);
});

/** POST /api/promo/apply  { code, bookingId } */
const apply = asyncHandler(async (req, res) => {
  const { code, bookingId } = v.parseApplyBody(req.body);
  const data = await service.applyCode({ code, bookingId, driverId: req.userId, role: req.user.role });
  return ok(res, data, `${data.code} applied — ${formatPoisha(data.discountPoisha)} off`);
});

/** DELETE /api/promo/booking/:bookingId */
const remove = asyncHandler(async (req, res) => {
  const data = await service.removeCode({
    bookingId: req.params.bookingId,
    driverId: req.userId,
    role: req.user.role,
  });
  return ok(res, data, `${data.removed} removed`);
});

/** GET /api/promo/active?propertyType=MALL */
const listActive = asyncHandler(async (req, res) => {
  const propertyType = req.query.propertyType ? String(req.query.propertyType).toUpperCase() : undefined;
  const data = await service.listActive({ propertyType });
  return ok(res, data, `${data.items.length} offer${data.items.length === 1 ? '' : 's'} available`);
});

/* --------------------------------------------------------------- admin -- */

/** GET /api/promo/admin/codes */
const listAll = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);
  return ok(res, await service.listAll({ page, limit }));
});

/** POST /api/promo/admin/codes */
const createCode = asyncHandler(async (req, res) => {
  const payload = v.parseAdminBody(req.body);
  const promo = await service.createCode(payload, req.userId);
  return created(res, promo, `${promo.code} created`);
});

/** PATCH /api/promo/admin/codes/:id */
const updateCode = asyncHandler(async (req, res) => {
  const payload = v.parseAdminBody(req.body, { partial: true });
  const promo = await service.updateCode(req.params.id, payload);
  return ok(res, promo, `${promo.code} updated`);
});

module.exports = { validate, apply, remove, listActive, listAll, createCode, updateCode };
