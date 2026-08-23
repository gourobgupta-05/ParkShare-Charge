/**
 * CALENDAR CONTROLLER — OWNER: Gourob Gupta [GG]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const service = require('./calendar.service');
const v = require('./calendar.validator');
const { sweepOnce } = require('./calendar.worker');
const { ROLES } = require('../../shared/constants');

/** GET /api/calendar/availability/:propertyId?date=YYYY-MM-DD */
const dayAvailability = asyncHandler(async (req, res) => {
  const { date } = v.parseDayQuery(req.query);
  const data = await service.getDayAvailability(req.params.propertyId, date);
  return ok(res, data, `${data.summary.available} of ${data.summary.total} slots free`);
});

/** GET /api/calendar/availability/:propertyId/range?from=&to= */
const rangeAvailability = asyncHandler(async (req, res) => {
  const { from, to } = v.parseRangeQuery(req.query);
  return ok(res, await service.getRangeSummary(req.params.propertyId, from, to));
});

/**
 * POST /api/calendar/bookings  { propertyId, startAt, endAt }
 * The mall-hours guard runs as middleware before this and leaves its verdict
 * on req.mallHoursCheck.
 */
const createBooking = asyncHandler(async (req, res) => {
  const body = v.parseBookingBody(req.body);
  const booking = await service.createBooking({
    ...body,
    driverId: req.userId,
    mallHoursCheck: req.mallHoursCheck,
  });

  return created(
    res,
    { booking, nextStep: 'PAY_INTO_ESCROW' },
    'Slot held. Pay within 10 minutes to confirm.'
  );
});

/** GET /api/calendar/bookings?scope=driver|host&status= */
const listBookings = asyncHandler(async (req, res) => {
  const q = v.parseListQuery(req.query);
  const data = await service.listBookings({ userId: req.userId, role: req.user.role, ...q });
  return ok(res, data);
});

/** GET /api/calendar/bookings/:id */
const getBooking = asyncHandler(async (req, res) =>
  ok(res, await service.getBooking(req.params.id, req.userId, req.user.role))
);

/** POST /api/calendar/bookings/:id/cancel */
const cancelBooking = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.cancelPending({
      bookingId: req.params.id,
      actorId: req.userId,
      isAdmin: req.user.role === ROLES.ADMIN,
    }),
    'Booking cancelled and the slot released'
  )
);

/* ------------------------------------------------------------ host side -- */

/** GET /api/calendar/my-calendars */
const myCalendars = asyncHandler(async (req, res) =>
  ok(res, { items: await service.listHostCalendars(req.userId) })
);

/** PUT /api/calendar/availability/:propertyId  { rules, blackoutDates } */
const setAvailability = asyncHandler(async (req, res) => {
  const body = v.parseAvailabilityBody(req.body);
  const data = await service.setAvailability({
    propertyId: req.params.propertyId,
    hostId: req.userId,
    isAdmin: req.user.role === ROLES.ADMIN,
    ...body,
  });
  return ok(res, data, 'Calendar saved');
});

/** POST /api/calendar/sweep — admin: release stale locks on demand */
const runSweep = asyncHandler(async (_req, res) => ok(res, await sweepOnce(), 'Sweep complete'));

module.exports = {
  dayAvailability,
  rangeAvailability,
  createBooking,
  listBookings,
  getBooking,
  cancelBooking,
  myCalendars,
  setAvailability,
  runSweep,
};
