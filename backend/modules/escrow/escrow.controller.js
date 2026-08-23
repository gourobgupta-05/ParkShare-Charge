/**
 * ESCROW CONTROLLER — OWNER: Tamal Deb Nath [TDN]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const { formatPoisha } = require('../../utils/money');
const service = require('./escrow.service');
const topUp = require('./walletTopUp.service');
const { holdFunds } = require('./escrowHold.transaction');
const refundService = require('./refund.service');
const v = require('./escrow.validator');

/* ------------------------------------------------------------- wallet --- */

/** GET /api/escrow/wallet */
const wallet = asyncHandler(async (req, res) =>
  ok(res, await topUp.getWalletSummary(req.userId, req.user.role))
);

/** POST /api/escrow/topup  { amountPoisha } */
const initiateTopUp = asyncHandler(async (req, res) => {
  const body = v.parseTopUpBody(req.body);
  const data = await topUp.initiateTopUp({ userId: req.userId, ...body });
  return created(res, data, 'Top-up started');
});

/** POST /api/escrow/topup/confirm  { token, amountPoisha? , val_id? } */
const confirmTopUp = asyncHandler(async (req, res) => {
  const data = await topUp.confirmTopUp({
    userId: req.userId,
    token: req.body?.token,
    payload: req.body || {},
  });
  return ok(res, data, data.alreadyProcessed ? 'Already credited' : `Added ${formatPoisha(data.amountPoisha)}`);
});

/** POST /api/escrow/tokenize  { method } */
const tokenize = asyncHandler(async (req, res) =>
  ok(res, await topUp.tokenizeInstrument({ userId: req.userId, method: req.body?.method }), 'Instrument tokenized')
);

/* -------------------------------------------------------------- escrow -- */

/** POST /api/escrow/hold  { bookingId, method?, gatewayToken? }  ← ACID txn */
const hold = asyncHandler(async (req, res) => {
  const body = v.parseHoldBody(req.body);
  const data = await holdFunds({ ...body, driverId: req.userId });
  return created(res, data, `${formatPoisha(data.amountPoisha)} locked in escrow`);
});

/** GET /api/escrow/booking/:bookingId */
const getHold = asyncHandler(async (req, res) =>
  ok(res, await service.getHoldForBooking(req.params.bookingId, req.userId, req.user.role))
);

/** GET /api/escrow/mine */
const myHolds = asyncHandler(async (req, res) =>
  ok(res, { items: await service.listMyHolds(req.userId) })
);

/** POST /api/escrow/refund/:bookingId  { amountPoisha?, reason? } */
const refund = asyncHandler(async (req, res) => {
  const body = v.parseRefundBody(req.body);
  const data = await refundService.refund({
    bookingId: req.params.bookingId,
    actorId: req.userId,
    isAdmin: req.user.role === 'ADMIN',
    ...body,
  });
  return ok(res, data, `${formatPoisha(data.refundedPoisha)} returned to the wallet`);
});

/** POST /api/escrow/dispute/:bookingId  { reason } */
const dispute = asyncHandler(async (req, res) =>
  ok(
    res,
    await refundService.openDispute({
      bookingId: req.params.bookingId,
      actorId: req.userId,
      reason: req.body?.reason,
    }),
    'Dispute opened'
  )
);

/* --------------------------------------------------------------- admin -- */

/** GET /api/escrow/holds?status=HELD&page=1 */
const listHolds = asyncHandler(async (req, res) => {
  const status = v.parseStatusFilter(req.query.status);
  const data = await service.listHolds({
    status,
    page: Math.max(parseInt(req.query.page || '1', 10), 1),
    limit: Math.min(parseInt(req.query.limit || '20', 10), 50),
  });
  return ok(res, data);
});

module.exports = {
  wallet, initiateTopUp, confirmTopUp, tokenize,
  hold, getHold, myHolds, refund, dispute, listHolds,
};
