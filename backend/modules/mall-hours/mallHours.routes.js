/**
 * Commercial Mall Operating Hours Guard Worker
 * MODULE 3  ·  OWNER: Tamal Deb Nath [TDN]  ·  Mounted at /api/mall-hours
 *
 * Requiring this file also starts the background guard worker, which is why no
 * shared file (server.js, config/cron.js) needs editing to schedule it.
 */
const router = require('express').Router();
const { authenticate, authorize, optionalAuth } = require('../../middleware/auth');
const { ROLES } = require('../../shared/constants');
const ctrl = require('./mallHours.controller');
const { startMallHoursWorker } = require('./mallHours.worker');

startMallHoursWorker();

router.post('/check', optionalAuth, ctrl.check);
router.get('/property/:id', optionalAuth, ctrl.getForProperty);

router.get('/my-properties', authenticate, authorize(ROLES.HOST, ROLES.ADMIN), ctrl.myProperties);
router.patch('/property/:id', authenticate, authorize(ROLES.HOST, ROLES.ADMIN), ctrl.update);

router.post('/sweep', authenticate, authorize(ROLES.ADMIN), ctrl.runSweep);

module.exports = router;
