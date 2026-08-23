/**
 * IoT CONTROLLER — OWNER: Maidul Islam [MI]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const service = require('./iot.service');
const { requestShutdown } = require('./remoteShutdown.service');

/** POST /api/iot/sessions/:bookingId/start */
const start = asyncHandler(async (req, res) => {
  const data = await service.startSession({
    bookingId: req.params.bookingId,
    userId: req.userId,
    role: req.user.role,
  });
  return created(res, data, 'Charging started');
});

/** POST /api/iot/sessions/:sessionId/pause */
const pause = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.pauseSession({ sessionId: req.params.sessionId, userId: req.userId, role: req.user.role }),
    'Charging paused'
  )
);

/** POST /api/iot/sessions/:sessionId/stop — the remote shutdown command */
const stop = asyncHandler(async (req, res) =>
  ok(
    res,
    await requestShutdown({
      sessionId: req.params.sessionId,
      userId: req.userId,
      role: req.user.role,
      reason: req.body?.reason,
    }),
    'Charger shut down'
  )
);

/** GET /api/iot/sessions/:bookingId */
const getSession = asyncHandler(async (req, res) =>
  ok(res, await service.getSession({ bookingId: req.params.bookingId, userId: req.userId, role: req.user.role }))
);

/** GET /api/iot/sessions/:bookingId/readings?limit= */
const getReadings = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.getReadings({
      bookingId: req.params.bookingId,
      userId: req.userId,
      role: req.user.role,
      limit: req.query.limit,
    })
  )
);

/** GET /api/iot/host/energy-logs */
const hostEnergyLogs = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);
  const data = await service.getHostEnergyLogs({ hostId: req.userId, page, limit });
  return ok(res, data, `${data.total} charging session${data.total === 1 ? '' : 's'}`);
});

/** GET /api/iot/broker-status */
const brokerStatus = asyncHandler(async (_req, res) => ok(res, service.brokerStatus()));

module.exports = { start, pause, stop, getSession, getReadings, hostEnergyLogs, brokerStatus };
