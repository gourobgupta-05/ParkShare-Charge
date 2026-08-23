/**
 * Dynamic BERC-Based Electricity Tariff Calculator
 * MODULE 3  ·  OWNER: Gourob Gupta [GG]  ·  Mounted at /api/tariff
 */
const router = require('express').Router();
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth');
const { ROLES } = require('../../shared/constants');
const ctrl = require('./tariff.controller');

/* public — drivers see the fare before signing in */
router.get('/rates', ctrl.rates);
router.post('/estimate', optionalAuth, ctrl.estimate);

/* authenticated */
router.post('/price/:bookingId', authenticate, ctrl.priceBooking);
router.post('/finalize/:bookingId', authenticate, ctrl.finalize);

/* admin — BERC slab management and the platform multiplier */
router.get('/admin/rates', authenticate, authorize(ROLES.ADMIN), ctrl.listRateSets);
router.post('/admin/rates', authenticate, authorize(ROLES.ADMIN), ctrl.publishRateSet);
router.patch('/admin/multiplier', authenticate, authorize(ROLES.ADMIN), ctrl.setMultiplier);

module.exports = router;
