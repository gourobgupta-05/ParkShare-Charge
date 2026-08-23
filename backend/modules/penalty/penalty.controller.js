/**
 * PENALTY CONTROLLER — OWNER: S. Moontaha Rahman [SMR]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/apiResponse');
const { formatPoisha } = require('../../utils/money');
const service = require('./penalty.service');
const { sweepOnce } = require('./penalty.worker');

/** POST /api/penalty/checkout/:bookingId — ends the session */
const checkout = asyncHandler(async (req, res) => {
  const data = await service.checkout({
    bookingId: req.params.bookingId,
    userId: req.userId,
    role: req.user.role,
  });

  const message = data.alreadyCheckedOut
    ? 'Already checked out'
    : data.accrual?.isLate
      ? `Checked out ${data.accrual.lateMinutes} min late — ${formatPoisha(data.accrual.accruedPoisha)} penalty applies`
      : 'Checked out — thanks for being on time';

  return ok(res, data, message);
});

/** GET /api/penalty/status/:bookingId — countdown for the session screen */
const status = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.getStatus({ bookingId: req.params.bookingId, userId: req.userId, role: req.user.role })
  )
);

/** GET /api/penalty/mine */
const listMine = asyncHandler(async (req, res) =>
  ok(res, await service.listMine({ driverId: req.userId }))
);

/** POST /api/penalty/:id/pay */
const pay = asyncHandler(async (req, res) => {
  const data = await service.payPenalty({
    penaltyId: req.params.id,
    driverId: req.userId,
    role: req.user.role,
  });
  return ok(
    res,
    data,
    data.alreadySettled
      ? 'That penalty is already settled'
      : `${formatPoisha(data.chargedPoisha)} paid — your account is unlocked`
  );
});

/* --------------------------------------------------------------- admin -- */

/** GET /api/penalty/admin/list?status= */
const listAll = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);
  const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
  return ok(res, await service.listAll({ status, page, limit }));
});

/** POST /api/penalty/admin/:id/waive  { reason } */
const waive = asyncHandler(async (req, res) => {
  const data = await service.waivePenalty({
    penaltyId: req.params.id,
    adminId: req.userId,
    reason: req.body?.reason,
  });
  return ok(res, data, data.alreadyClosed ? 'Already closed' : 'Penalty waived');
});

/** POST /api/penalty/admin/sweep — run the worker on demand */
const runSweep = asyncHandler(async (_req, res) => ok(res, await sweepOnce(), 'Sweep complete'));

module.exports = { checkout, status, listMine, pay, listAll, waive, runSweep };
