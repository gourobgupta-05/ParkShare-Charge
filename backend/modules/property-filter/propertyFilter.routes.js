/**
 * Property Category Search Filter Toggle
 * MODULE 2  ·  OWNER: Tamal Deb Nath [TDN]  ·  Mounted at /api/filter
 */
const router = require('express').Router();
const { optionalAuth } = require('../../middleware/auth');
const ctrl = require('./propertyFilter.controller');

router.get('/properties', optionalAuth, ctrl.list);
router.get('/counts', optionalAuth, ctrl.counts);
router.get('/options', ctrl.options);

module.exports = router;
