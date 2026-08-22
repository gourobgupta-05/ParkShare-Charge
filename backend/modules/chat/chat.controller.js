/**
 * CHAT CONTROLLER — OWNER: Maidul Islam [MI]
 * REST mirrors the socket API so the chat still works when WebSockets are
 * blocked by a network, or while Render's free instance is cold-starting.
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const service = require('./chat.service');
const { getChatNamespace } = require('./chat.socket');
const { SOCKET_EVENTS } = require('../../shared/constants');

/** POST /api/chat/threads/ensure/:bookingId */
const ensureThread = asyncHandler(async (req, res) => {
  const thread = await service.ensureThread({
    bookingId: req.params.bookingId,
    userId: req.userId,
    role: req.user.role,
  });
  return created(res, thread, 'Conversation ready');
});

/** GET /api/chat/threads */
const listThreads = asyncHandler(async (req, res) =>
  ok(res, await service.listThreads({ userId: req.userId, role: req.user.role }))
);

/** GET /api/chat/threads/:threadId/messages?before=&limit= */
const getMessages = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.getMessages({
      threadId: req.params.threadId,
      userId: req.userId,
      role: req.user.role,
      before: req.query.before,
      limit: req.query.limit,
    })
  )
);

/** POST /api/chat/threads/:threadId/messages  { body } — socket fallback */
const sendMessage = asyncHandler(async (req, res) => {
  const { message, recipientId } = await service.sendMessage({
    threadId: req.params.threadId,
    userId: req.userId,
    role: req.user.role,
    body: req.body?.body,
  });

  // Mirror onto the socket so a recipient with an open tab still sees it live.
  const nsp = getChatNamespace();
  if (nsp) {
    nsp.to(`thread:${req.params.threadId}`).emit(SOCKET_EVENTS.CHAT_MESSAGE, message);
    nsp.to(`user:${recipientId}`).emit(SOCKET_EVENTS.NOTIFICATION_PUSH, {
      type: 'CHAT',
      threadId: req.params.threadId,
      at: message.createdAt,
    });
  }

  return created(res, message, message.wasRedacted ? 'Sent — contact details were hidden' : 'Sent');
});

/** POST /api/chat/threads/:threadId/read */
const markRead = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.markRead({ threadId: req.params.threadId, userId: req.userId, role: req.user.role }),
    'Marked as read'
  )
);

/** GET /api/chat/unread */
const unread = asyncHandler(async (req, res) =>
  ok(res, await service.getUnreadTotal({ userId: req.userId, role: req.user.role }))
);

module.exports = { ensureThread, listThreads, getMessages, sendMessage, markRead, unread };
