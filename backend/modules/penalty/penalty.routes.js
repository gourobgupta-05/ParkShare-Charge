/**
 * Active Delayed Checkout Penalty & Push Alert Worker
 * OWNER: S. Moontaha Rahman [SMR]  ·  Mounted at /api/penalty
 *
 * ⚠️ STUB — S. Moontaha Rahman replaces this file with their implementation.
 * Nobody else commits inside this folder.
 */
const router = require('express').Router();
const ApiError = require('../../utils/ApiError');

router.use((_req, _res, next) =>
  next(ApiError.notImplemented('Active Delayed Checkout Penalty & Push Alert Worker is not built yet — owner: S. Moontaha Rahman'))
);

module.exports = router;
