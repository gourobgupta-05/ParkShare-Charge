/**
 * Automated Split Payout Settlement Ledger
 * OWNER: S. Moontaha Rahman [SMR]  ·  Mounted at /api/payout
 *
 * ⚠️ STUB — S. Moontaha Rahman replaces this file with their implementation.
 * Nobody else commits inside this folder.
 */
const router = require('express').Router();
const ApiError = require('../../utils/ApiError');

router.use((_req, _res, next) =>
  next(ApiError.notImplemented('Automated Split Payout Settlement Ledger is not built yet — owner: S. Moontaha Rahman'))
);

module.exports = router;
