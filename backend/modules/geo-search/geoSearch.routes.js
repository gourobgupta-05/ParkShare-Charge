/**
 * Real-Time Interactive Geospatial Search Matrix
 * OWNER: Tamal Deb Nath [TDN]  ·  Mounted at /api/geo
 *
 * ⚠️ STUB — Tamal Deb Nath replaces this file with their implementation.
 * Nobody else commits inside this folder.
 */
const router = require('express').Router();
const ApiError = require('../../utils/ApiError');

router.use((_req, _res, next) =>
  next(ApiError.notImplemented('Real-Time Interactive Geospatial Search Matrix is not built yet — owner: Tamal Deb Nath'))
);

module.exports = router;
