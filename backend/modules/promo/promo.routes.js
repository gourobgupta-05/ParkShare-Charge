/**
 * Commercial Partner Mall Promo Code Engine
 * OWNER: Maidul Islam [MI]  ·  Mounted at /api/promo
 *
 * ⚠️ STUB — Maidul Islam replaces this file with their implementation.
 * Nobody else commits inside this folder.
 */
const router = require('express').Router();
const ApiError = require('../../utils/ApiError');

router.use((_req, _res, next) =>
  next(ApiError.notImplemented('Commercial Partner Mall Promo Code Engine is not built yet — owner: Maidul Islam'))
);

module.exports = router;
