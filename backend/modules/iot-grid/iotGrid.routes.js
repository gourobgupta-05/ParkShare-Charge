/**
 * Simulated IoT WebSocket Power Grid Broker
 * MODULE 2  ·  OWNER: Maidul Islam [MI]  ·  Mounted at /api/iot
 *
 * REST handles the session lifecycle and history; live telemetry goes over the
 * /iot socket namespace, registered by realtime/index.js.
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../../middleware/auth');
const { ROLES } = require('../../shared/constants');
const ctrl = require('./iot.controller');

router.use(authenticate);

router.get('/broker-status', ctrl.brokerStatus);
router.get('/host/energy-logs', authorize(ROLES.HOST, ROLES.ADMIN), ctrl.hostEnergyLogs);

router.post('/sessions/:bookingId/start', ctrl.start);
router.get('/sessions/:bookingId', ctrl.getSession);
router.get('/sessions/:bookingId/readings', ctrl.getReadings);

router.post('/sessions/:sessionId/pause', ctrl.pause);
router.post('/sessions/:sessionId/stop', ctrl.stop);

module.exports = router;
