/**
 * Host Verification & Garage Space Provisioning Pipeline
 * MODULE 2  ·  OWNER: S. Moontaha Rahman [SMR]
 * Mounted at /api/host-verification
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../../middleware/auth');
const { ROLES } = require('../../shared/constants');
const ctrl = require('./hostVerification.controller');
const admin = require('./adminAudit.controller');

router.use(authenticate);

/* ------------------------------------------------------------- admin --- */
router.get('/admin/queue', authorize(ROLES.ADMIN), admin.queue);
router.get('/admin/:id', authorize(ROLES.ADMIN), admin.detail);
router.post('/admin/:id/approve', authorize(ROLES.ADMIN), admin.approve);
router.post('/admin/:id/reject', authorize(ROLES.ADMIN), admin.reject);

/* -------------------------------------------------------------- host --- */
router.use(authorize(ROLES.HOST, ROLES.ADMIN));

router.get('/me', ctrl.getMine);
router.patch('/me', ctrl.saveDraft);
router.post('/documents', ctrl.uploadDocument);
router.post('/submit', ctrl.submit);

router.get('/spaces', ctrl.listMySpaces);
router.post('/spaces', ctrl.provision);
router.patch('/spaces/:propertyId/publish', ctrl.setPublished);

module.exports = router;
