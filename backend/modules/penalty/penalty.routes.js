/**
 * Active Delayed Checkout Penalty & Push Alert Worker
 * MODULE 3  ·  OWNER: S. Moontaha Rahman [SMR]  ·  Mounted at /api/penalty
 *
 * Requiring this file also starts the timed worker, so no shared file needs
 * editing to schedule it.
 *
 * Note the deliberate absence of blockIfPenaltyLocked on these routes: a
 * locked driver must be able to reach /pay, or the lock would be inescapable.
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../../middleware/auth');
const { ROLES } = require('../../shared/constants');
const ctrl = require('./penalty.controller');
const { startPenaltyWorker } = require('./penalty.worker');

startPenaltyWorker();

router.use(authenticate);

/* admin */
router.get('/admin/list', authorize(ROLES.ADMIN), ctrl.listAll);
router.post('/admin/:id/waive', authorize(ROLES.ADMIN), ctrl.waive);
router.post('/admin/sweep', authorize(ROLES.ADMIN), ctrl.runSweep);

/* driver + host */
router.post('/checkout/:bookingId', ctrl.checkout);
router.get('/status/:bookingId', ctrl.status);
router.get('/mine', ctrl.listMine);
router.post('/:id/pay', ctrl.pay);

module.exports = router;
