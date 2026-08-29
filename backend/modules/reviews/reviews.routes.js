/**
 * Driver-Side Post-Session Feedback & Verification Matrix
 * MODULE 1  ·  OWNER: Gourob Gupta [GG]  ·  Mounted at /api/reviews
 */
const router = require('express').Router();
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth');
const { ROLES } = require('../../shared/constants');
const ctrl = require('./review.controller');

/* public reads — reviews are marketplace content */
router.get('/tags', ctrl.tags);
router.get('/property/:propertyId', optionalAuth, ctrl.listForProperty);
router.get('/host/:hostId', optionalAuth, ctrl.listForHost);

/* driver */
router.get('/pending', authenticate, authorize(ROLES.DRIVER), ctrl.listPending);
router.get('/booking/:bookingId', optionalAuth, ctrl.getByBooking);
router.post('/', authenticate, authorize(ROLES.DRIVER), ctrl.create);
router.patch('/:id', authenticate, authorize(ROLES.DRIVER), ctrl.edit);

/* host */
router.post('/:id/reply', authenticate, authorize(ROLES.HOST, ROLES.ADMIN), ctrl.reply);

/* admin */
router.post('/recompute', authenticate, authorize(ROLES.ADMIN), ctrl.recompute);

module.exports = router;
