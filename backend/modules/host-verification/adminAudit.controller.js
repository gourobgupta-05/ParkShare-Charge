/**
 * ADMIN AUDIT CONTROLLER — OWNER: S. Moontaha Rahman [SMR]
 * The review queue: read the documents, approve or reject with a reason.
 */
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { ok } = require('../../utils/apiResponse');
const { VERIFICATION_STATUS } = require('../../shared/constants');
const service = require('./hostVerification.service');

/** GET /api/host-verification/admin/queue?status= */
const queue = asyncHandler(async (req, res) => {
  let { status } = req.query;
  if (status) {
    status = String(status).toUpperCase();
    if (!Object.values(VERIFICATION_STATUS).includes(status)) {
      throw ApiError.badRequest('Unknown verification status', undefined, {
        status: `Must be one of: ${Object.values(VERIFICATION_STATUS).join(', ')}`,
      });
    }
  }

  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);

  const data = await service.listQueue({ status, page, limit });
  return ok(res, data, `${data.total} submission${data.total === 1 ? '' : 's'}`);
});

/** GET /api/host-verification/admin/:id */
const detail = asyncHandler(async (req, res) => ok(res, await service.getOne(req.params.id)));

/** POST /api/host-verification/admin/:id/approve  { notes? } */
const approve = asyncHandler(async (req, res) => {
  const data = await service.approve({
    verificationId: req.params.id,
    adminId: req.userId,
    notes: req.body?.notes,
  });
  return ok(res, data, data.alreadyApproved ? 'Already approved' : 'Host approved');
});

/** POST /api/host-verification/admin/:id/reject  { reason } */
const reject = asyncHandler(async (req, res) => {
  const data = await service.reject({
    verificationId: req.params.id,
    adminId: req.userId,
    reason: req.body?.reason,
  });
  return ok(res, data, 'Sent back to the host');
});

module.exports = { queue, detail, approve, reject };
