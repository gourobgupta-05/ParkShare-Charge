/**
 * Automated Split Payout Settlement Ledger
 * MODULE 3  ·  OWNER: S. Moontaha Rahman [SMR]  ·  Mounted at /api/payout
 *
 * Settlement normally fires automatically from the checkout flow in the
 * penalty module. The route below is the manual/admin trigger and the retry
 * path for a session that finished while the server was asleep.
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../../middleware/auth');
const { ROLES } = require('../../shared/constants');
const ctrl = require('./earnings.controller');
const commission = require('./commissionAdmin.controller');

router.use(authenticate);

/* admin */
router.get('/admin/commission', authorize(ROLES.ADMIN), commission.getCommission);
router.patch('/admin/commission', authorize(ROLES.ADMIN), commission.setCommission);
router.get('/admin/batches', authorize(ROLES.ADMIN), ctrl.listBatches);
router.post('/admin/batches/:id/paid', authorize(ROLES.ADMIN), ctrl.markPaid);

/* host */
router.get('/earnings', authorize(ROLES.HOST, ROLES.ADMIN), ctrl.earnings);
router.get('/ledger', ctrl.ledger);
router.post('/withdraw', authorize(ROLES.HOST), ctrl.withdraw);

/* settlement trigger */
router.post('/settle/:bookingId', authorize(ROLES.ADMIN, ROLES.HOST), ctrl.settle);

module.exports = router;
