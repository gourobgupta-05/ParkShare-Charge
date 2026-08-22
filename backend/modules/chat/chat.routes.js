/**
 * Live P2P Encrypted WebSocket Coordination Chat
 * MODULE 3  ·  OWNER: Maidul Islam [MI]  ·  Mounted at /api/chat
 *
 * Live messaging runs over the /chat socket namespace; these REST routes cover
 * history, unread counts, and a fallback send path for when sockets are
 * unavailable.
 */
const router = require('express').Router();
const { authenticate } = require('../../middleware/auth');
const ctrl = require('./chat.controller');

router.use(authenticate);

router.get('/threads', ctrl.listThreads);
router.get('/unread', ctrl.unread);
router.post('/threads/ensure/:bookingId', ctrl.ensureThread);
router.get('/threads/:threadId/messages', ctrl.getMessages);
router.post('/threads/:threadId/messages', ctrl.sendMessage);
router.post('/threads/:threadId/read', ctrl.markRead);

module.exports = router;
