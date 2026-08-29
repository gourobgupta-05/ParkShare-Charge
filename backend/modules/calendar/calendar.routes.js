/**
 * Live Interactive Calendar Scheduler & Slot Locking
 * MODULE 2  ·  OWNER: Gourob Gupta [GG]  ·  Mounted at /api/calendar
 *
 * Requiring this file also starts the pending-booking sweeper, so no shared
 * file needs editing to schedule it.
 *
 * Booking creation runs [TDN]'s mall-hours guard first — imported, never
 * edited. It rejects windows that overrun a mall's closing time and leaves its
 * verdict on req.mallHoursCheck for the controller to persist.
 */
const router = require('express').Router();
const { authenticate, authorize, optionalAuth, blockIfPenaltyLocked } = require('../../middleware/auth');
const { mallHoursGuard } = require('../mall-hours/mallHoursGuard.middleware');
const { ROLES } = require('../../shared/constants');
const ctrl = require('./calendar.controller');
const { startCalendarWorker } = require('./calendar.worker');

startCalendarWorker();

/* public — a signed-out visitor can browse availability before registering */
router.get('/availability/:propertyId', optionalAuth, ctrl.dayAvailability);
router.get('/availability/:propertyId/range', optionalAuth, ctrl.rangeAvailability);

/* driver */
router.post(
  '/bookings',
  authenticate,
  authorize(ROLES.DRIVER),
  blockIfPenaltyLocked,
  mallHoursGuard(),
  ctrl.createBooking
);
router.get('/bookings', authenticate, ctrl.listBookings);
router.get('/bookings/:id', authenticate, ctrl.getBooking);
router.post('/bookings/:id/cancel', authenticate, ctrl.cancelBooking);

/* host */
router.get('/my-calendars', authenticate, authorize(ROLES.HOST, ROLES.ADMIN), ctrl.myCalendars);
router.put('/availability/:propertyId', authenticate, authorize(ROLES.HOST, ROLES.ADMIN), ctrl.setAvailability);

/* admin */
router.post('/sweep', authenticate, authorize(ROLES.ADMIN), ctrl.runSweep);

module.exports = router;