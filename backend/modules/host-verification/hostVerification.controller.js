/**
 * HOST VERIFICATION CONTROLLER — OWNER: S. Moontaha Rahman [SMR]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const service = require('./hostVerification.service');

/** GET /api/host-verification/me */
const getMine = asyncHandler(async (req, res) => ok(res, await service.getMine(req.userId)));

/** PATCH /api/host-verification/me  { nid, ownership, chargerMetrics } */
const saveDraft = asyncHandler(async (req, res) => {
  const data = await service.saveDraft({ hostId: req.userId, ...(req.body || {}) });
  return ok(res, data, 'Saved');
});

/** POST /api/host-verification/documents  { kind, file: { mimeType, base64 } } */
const uploadDocument = asyncHandler(async (req, res) => {
  const data = await service.attachDocument({
    hostId: req.userId,
    kind: req.body?.kind,
    file: req.body?.file,
  });
  return created(res, data, 'Document uploaded');
});

/** POST /api/host-verification/submit */
const submit = asyncHandler(async (req, res) => {
  const data = await service.submit(req.userId);
  return ok(res, data, 'Submitted for review');
});

/* ------------------------------------------------------- provisioning -- */

/** GET /api/host-verification/spaces */
const listMySpaces = asyncHandler(async (req, res) =>
  ok(res, { items: await service.listMySpaces(req.userId) })
);

/** POST /api/host-verification/spaces */
const provision = asyncHandler(async (req, res) => {
  const property = await service.provisionProperty({
    hostId: req.userId,
    role: req.user.role,
    payload: req.body || {},
  });
  return created(res, property, 'Space created — open its calendar, then publish it');
});

/** PATCH /api/host-verification/spaces/:propertyId/publish  { isPublished } */
const setPublished = asyncHandler(async (req, res) => {
  const data = await service.setPublished({
    propertyId: req.params.propertyId,
    hostId: req.userId,
    role: req.user.role,
    isPublished: req.body?.isPublished !== false,
  });
  return ok(res, data, data.isPublished ? 'Space is live' : 'Space unpublished');
});

module.exports = { getMine, saveDraft, uploadDocument, submit, listMySpaces, provision, setPublished };
