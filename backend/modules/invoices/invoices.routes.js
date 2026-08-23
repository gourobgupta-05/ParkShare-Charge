/**
 * Automated PDF Invoice Engine with VAT Breakdown
 * MODULE 3  ·  OWNER: Gourob Gupta [GG]  ·  Mounted at /api/invoices
 */
const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const ctrl = require('./invoice.controller');

router.use(authenticate); // invoices are private financial records

router.get('/', ctrl.list);
router.post('/generate/:bookingId', ctrl.generate);
router.get('/:id', ctrl.detail);
router.get('/:id/pdf', ctrl.downloadPdf);

module.exports = router;
