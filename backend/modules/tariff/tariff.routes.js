/**
 * Dynamic BERC-Based Electricity Tariff Calculator
 * OWNER: Gourob Gupta [GG]  ·  Mounted at /api/tariff
 *
 * ⚠️ STUB — Gourob Gupta replaces this file with their implementation.
 * Nobody else commits inside this folder.
 */
const router = require('express').Router();
const ApiError = require('../../utils/ApiError');

router.use((_req, _res, next) =>
  next(ApiError.notImplemented('Dynamic BERC-Based Electricity Tariff Calculator is not built yet — owner: Gourob Gupta'))
);

module.exports = router;
