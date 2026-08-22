/**
 * Simulated IoT WebSocket Power Grid Broker
 * OWNER: Maidul Islam [MI]  ·  Mounted at /api/iot
 *
 * ⚠️ STUB — Maidul Islam replaces this file with their implementation.
 * Nobody else commits inside this folder.
 */
const router = require('express').Router();
const ApiError = require('../../utils/ApiError');

router.use((_req, _res, next) =>
  next(ApiError.notImplemented('Simulated IoT WebSocket Power Grid Broker is not built yet — owner: Maidul Islam'))
);

module.exports = router;
