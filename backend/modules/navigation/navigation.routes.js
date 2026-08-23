/**
 * Turn-by-Turn Smart In-App Navigation Engine
 * OWNER: Maidul Islam [MI]  ·  Mounted at /api/navigation
 *
 * ⚠️ STUB — Maidul Islam replaces this file with their implementation.
 * Nobody else commits inside this folder.
 */
const router = require('express').Router();
const ApiError = require('../../utils/ApiError');

router.use((_req, _res, next) =>
  next(ApiError.notImplemented('Turn-by-Turn Smart In-App Navigation Engine is not built yet — owner: Maidul Islam'))
);

module.exports = router;
