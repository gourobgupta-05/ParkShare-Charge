/**
 * EARNINGS CONTROLLER — OWNER: S. Moontaha Rahman [SMR]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const { formatPoisha } = require('../../utils/money');
const service = require('./payout.service');
const { settleBooking } = require('./settlement.transaction');

/** GET /api/payout/earnings */
const earnings = asyncHandler(async (req, res) =>
  ok(res, await service.getEarnings({ hostId: req.userId }))
);

/** GET /api/payout/ledger */
const ledger = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '25', 10), 1), 50);
  return ok(res, await service.getLedger({ userId: req.userId, page, limit }));
});

/** POST /api/payout/withdraw  { amountPoisha } */
const withdraw = asyncHandler(async (req, res) => {
  const data = await service.requestWithdrawal({
    hostId: req.userId,
    amountPoisha: Number(req.body?.amountPoisha),
  });
  return created(
    res,
    data,
    `${formatPoisha(data.batch.grossPoisha)} requested — it will reach your account shortly`
  );
});

/** POST /api/payout/settle/:bookingId — admin/manual trigger */
const settle = asyncHandler(async (req, res) => {
  const data = await settleBooking({
    bookingId: req.params.bookingId,
    actorId: req.userId,
    reason: 'MANUAL_SETTLEMENT',
  });
  return ok(
    res,
    data,
    data.alreadySettled
      ? 'This booking was already settled'
      : `Split complete — host ${formatPoisha(data.hostCreditPoisha)}, platform ${formatPoisha(data.commissionPoisha)}`
  );
});

/** GET /api/payout/admin/batches */
const listBatches = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);
  const data = await service.listAllBatches({
    kind: req.query.kind,
    status: req.query.status,
    page,
    limit,
  });
  return ok(res, data);
});

/** POST /api/payout/admin/batches/:id/paid */
const markPaid = asyncHandler(async (req, res) => {
  const data = await service.markWithdrawalPaid({ batchId: req.params.id, adminId: req.userId });
  return ok(res, data, data.alreadyPaid ? 'Already marked paid' : 'Marked as disbursed');
});

module.exports = { earnings, ledger, withdraw, settle, listBatches, markPaid };
