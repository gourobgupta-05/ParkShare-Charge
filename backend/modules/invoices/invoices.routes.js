/**
 * Automated PDF Invoice Engine with VAT Breakdown
 * OWNER: Gourob Gupta [GG]  ·  Mounted at /api/invoices
 *
 * ⚠️ STUB — Gourob Gupta replaces this file with their implementation.
 * Nobody else commits inside this folder.
 */
const router = require('express').Router();
const ApiError = require('../../utils/ApiError');

router.use((_req, _res, next) =>
  next(ApiError.notImplemented('Automated PDF Invoice Engine with VAT Breakdown is not built yet — owner: Gourob Gupta'))
);

module.exports = router;
