/**
 * Live Geofenced Automated Proximity Check-In
 * MODULE 1  ·  OWNER: S. Moontaha Rahman [SMR]  ·  Mounted at /api/geofence
 *
 * This module is the sole writer of the ACTIVE booking status.
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../../middleware/auth');
const { ROLES } = require('../../shared/constants');
const ctrl = require('./geofence.controller');

router.use(authenticate);

router.get('/target/:bookingId', ctrl.target);
router.post('/ping/:bookingId', ctrl.ping);
router.post('/checkin/:bookingId', ctrl.manualCheckIn);

/* digital entry pass — replaces the cut OCR feature */
router.get('/pass/:bookingId', ctrl.issuePass);
router.post('/pass/verify', authorize(ROLES.HOST, ROLES.ADMIN), ctrl.verifyPass);

module.exports = router;
