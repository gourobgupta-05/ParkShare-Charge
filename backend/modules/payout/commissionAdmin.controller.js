/**
 * COMMISSION ADMIN — OWNER: S. Moontaha Rahman [SMR]
 * The platform's cut lives on PlatformConfig, never hardcoded in a screen.
 * Changing it affects future settlements only — historical PayoutBatch rows
 * record the rate that applied at the time, so old invoices stay correct.
 */
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { ok } = require('../../utils/apiResponse');
const { PlatformConfig } = require('../../models');
const PayoutBatch = require('./payoutBatch.model');

/** GET /api/payout/admin/commission */
const getCommission = asyncHandler(async (_req, res) => {
  const config = await PlatformConfig.current();
  const totals = await PayoutBatch.aggregate([
    { $match: { kind: 'SETTLEMENT' } },
    {
      $group: {
        _id: null,
        commissionPoisha: { $sum: '$commissionPoisha' },
        grossPoisha: { $sum: '$grossPoisha' },
        settlements: { $sum: 1 },
      },
    },
  ]);

  return ok(res, {
    commissionRate: config.commissionRate,
    vatRate: config.vatRate,
    revenue: totals[0] || { commissionPoisha: 0, grossPoisha: 0, settlements: 0 },
  });
});

/** PATCH /api/payout/admin/commission  { commissionRate } */
const setCommission = asyncHandler(async (req, res) => {
  const rate = Number(req.body?.commissionRate);

  if (!Number.isFinite(rate) || rate < 0 || rate > 0.5) {
    throw ApiError.badRequest('Commission must be between 0% and 50%', undefined, {
      commissionRate: 'Enter a rate between 0 and 0.5',
    });
  }

  const config = await PlatformConfig.current();
  config.commissionRate = rate;
  config.updatedBy = req.userId;
  await config.save();

  return ok(
    res,
    { commissionRate: config.commissionRate },
    `Commission set to ${(rate * 100).toFixed(1)}% for future settlements`
  );
});

module.exports = { getCommission, setCommission };
