/**
 * Secure Multi-Gateway Tokenized Escrow System
 * MODULE 3  ·  OWNER: Tamal Deb Nath [TDN]  ·  Mounted at /api/escrow
 *
 * Every route needs a session. Note that a penalty-locked driver is NOT
 * blocked here — they must still be able to top up and clear the penalty.
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../../middleware/auth');
const { ROLES } = require('../../shared/constants');
const ctrl = require('./escrow.controller');

router.use(authenticate);

/* wallet */
router.get('/wallet', ctrl.wallet);
router.post('/topup', ctrl.initiateTopUp);
router.post('/topup/confirm', ctrl.confirmTopUp);
router.post('/tokenize', ctrl.tokenize);

/* escrow */
router.post('/hold', authorize(ROLES.DRIVER), ctrl.hold);
router.get('/mine', ctrl.myHolds);
router.get('/booking/:bookingId', ctrl.getHold);
router.post('/refund/:bookingId', ctrl.refund);
router.post('/dispute/:bookingId', ctrl.dispute);

/* admin */
router.get('/holds', authorize(ROLES.ADMIN), ctrl.listHolds);

module.exports = router;
