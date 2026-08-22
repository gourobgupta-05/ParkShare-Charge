/**
 * Real-Time Interactive Geospatial Search Matrix
 * MODULE 1  ·  OWNER: Tamal Deb Nath [TDN]  ·  Mounted at /api/geo
 *
 * Search is deliberately PUBLIC (optionalAuth) so a signed-out visitor can
 * browse the map before creating an account — that is the marketplace funnel.
 */
const router = require('express').Router();
const { optionalAuth } = require('../../middleware/auth');
const ctrl = require('./geoSearch.controller');

router.get('/search', optionalAuth, ctrl.search);
router.get('/viewport', optionalAuth, ctrl.viewport);
router.get('/index-health', ctrl.indexHealth);
router.get('/properties/:id', optionalAuth, ctrl.detail);

module.exports = router;
