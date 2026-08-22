/**
 * Commercial Partner Mall Promo Code Engine
 * MODULE 3  ·  OWNER: Maidul Islam [MI]  ·  Mounted at /api/promo
 */
const router = require('express').Router();
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth');
const { ROLES } = require('../../shared/constants');
const ctrl = require('./promo.controller');

/* public — the offers strip renders before sign-in */
router.get('/active', optionalAuth, ctrl.listActive);

/* driver */
router.post('/validate', authenticate, authorize(ROLES.DRIVER, ROLES.ADMIN), ctrl.validate);
router.post('/apply', authenticate, authorize(ROLES.DRIVER, ROLES.ADMIN), ctrl.apply);
router.delete('/booking/:bookingId', authenticate, authorize(ROLES.DRIVER, ROLES.ADMIN), ctrl.remove);

/* admin */
router.get('/admin/codes', authenticate, authorize(ROLES.ADMIN), ctrl.listAll);
router.post('/admin/codes', authenticate, authorize(ROLES.ADMIN), ctrl.createCode);
router.patch('/admin/codes/:id', authenticate, authorize(ROLES.ADMIN), ctrl.updateCode);

module.exports = router;
