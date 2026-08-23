/**
 * ============================================================================
 * 🔒 ROUTE REGISTRY — DO NOT EDIT AFTER INITIAL SETUP
 * ============================================================================
 * Every mount point in the project is declared here ONCE, on day one, pointing
 * at stub routers that return 501. Members fill in their own stub; nobody ever
 * edits this file. That is what stops four people conflicting in one router.
 * ============================================================================
 */
const router = require('express').Router();

/* ------------------------------------------- shared / common (initializer) */
router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/profile', require('./profile.routes'));

/* ------------------------------------------------- Tamal Deb Nath  [TDN]  */
router.use('/geo', require('../modules/geo-search/geoSearch.routes'));
router.use('/filter', require('../modules/property-filter/propertyFilter.routes'));
router.use('/escrow', require('../modules/escrow/escrow.routes'));
router.use('/mall-hours', require('../modules/mall-hours/mallHours.routes'));

/* --------------------------------------------------- Gourob Gupta  [GG]   */
router.use('/reviews', require('../modules/reviews/reviews.routes'));
router.use('/calendar', require('../modules/calendar/calendar.routes'));
router.use('/tariff', require('../modules/tariff/tariff.routes'));
router.use('/invoices', require('../modules/invoices/invoices.routes'));

/* --------------------------------------------------- Maidul Islam  [MI]   */
router.use('/navigation', require('../modules/navigation/navigation.routes'));
router.use('/iot', require('../modules/iot-grid/iotGrid.routes'));
router.use('/chat', require('../modules/chat/chat.routes'));
router.use('/promo', require('../modules/promo/promo.routes'));

/* --------------------------------------------- S. Moontaha Rahman [SMR]  */
router.use('/geofence', require('../modules/geofence/geofence.routes'));
router.use('/host-verification', require('../modules/host-verification/hostVerification.routes'));
router.use('/payout', require('../modules/payout/payout.routes'));
router.use('/penalty', require('../modules/penalty/penalty.routes'));

module.exports = router;
