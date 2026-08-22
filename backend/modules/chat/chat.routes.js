/**
 * Live P2P Encrypted WebSocket Coordination Chat
 * OWNER: Maidul Islam [MI]  ·  Mounted at /api/chat
 *
 * ⚠️ STUB — Maidul Islam replaces this file with their implementation.
 * Nobody else commits inside this folder.
 */
const router = require('express').Router();
const ApiError = require('../../utils/ApiError');

router.use((_req, _res, next) =>
  next(ApiError.notImplemented('Live P2P Encrypted WebSocket Coordination Chat is not built yet — owner: Maidul Islam'))
);

module.exports = router;
