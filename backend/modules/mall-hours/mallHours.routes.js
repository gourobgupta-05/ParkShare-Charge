/**
 * Commercial Mall Operating Hours Guard Worker
 * OWNER: Tamal Deb Nath [TDN]  ·  Mounted at /api/mall-hours
 *
 * ⚠️ STUB — Tamal Deb Nath replaces this file with their implementation.
 * Nobody else commits inside this folder.
 */
const router = require('express').Router();
const ApiError = require('../../utils/ApiError');

router.use((_req, _res, next) =>
  next(ApiError.notImplemented('Commercial Mall Operating Hours Guard Worker is not built yet — owner: Tamal Deb Nath'))
);

module.exports = router;
