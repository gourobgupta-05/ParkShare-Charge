/**
 * Turn-by-Turn Smart In-App Navigation Engine
 * MODULE 1  ·  OWNER: Maidul Islam [MI]  ·  Mounted at /api/navigation
 *
 * Every route needs a session: entrance coordinates are effectively a host's
 * home address, so they are never exposed to anonymous callers.
 */
const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const ctrl = require('./navigation.controller');

router.use(authenticate);

router.get('/provider', ctrl.provider);
router.get('/destination/:bookingId', ctrl.destination);
router.post('/route/:bookingId', ctrl.startRoute);
router.get('/eta/:bookingId', ctrl.eta);
router.post('/stop/:bookingId', ctrl.stopRoute);

module.exports = router;
