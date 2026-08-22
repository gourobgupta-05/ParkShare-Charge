/**
 * CHAT SOCKET NAMESPACE (/chat) — OWNER: Maidul Islam [MI]
 *
 * Registered once by realtime/index.js, which authenticates the handshake with
 * the same JWT as the REST API. Every socket also joins a personal room
 * (user:<id>) so unread badges can be pushed even when the thread is closed.
 */
const logger = require('../../utils/logger');
const { SOCKET_EVENTS } = require('../../shared/constants');
const service = require('./chat.service');

let namespaceRef = null;

module.exports = function registerChatNamespace(nsp) {
  namespaceRef = nsp;

  nsp.on('connection', (socket) => {
    logger.debug(`[chat] connected: ${socket.id} (user ${socket.userId})`);
    socket.join(`user:${socket.userId}`);

    /* join a thread */
    socket.on(SOCKET_EVENTS.CHAT_JOIN, async ({ threadId } = {}, ack) => {
      try {
        if (!threadId) throw new Error('threadId is required');
        await service.loadThread(threadId, socket.userId, socket.role);
        socket.join(`thread:${threadId}`);
        if (typeof ack === 'function') ack({ ok: true, threadId });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('chat:leave', ({ threadId } = {}) => {
      if (threadId) socket.leave(`thread:${threadId}`);
    });

    /* send a message */
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, async ({ threadId, body } = {}, ack) => {
      try {
        const { message, recipientId } = await service.sendMessage({
          threadId,
          userId: socket.userId,
          role: socket.role,
          body,
        });

        // Everyone watching the thread, including the sender's other tabs.
        nsp.to(`thread:${threadId}`).emit(SOCKET_EVENTS.CHAT_MESSAGE, message);

        // Badge update for the recipient even if they are not in the thread.
        nsp.to(`user:${recipientId}`).emit(SOCKET_EVENTS.NOTIFICATION_PUSH, {
          type: 'CHAT',
          threadId,
          at: message.createdAt,
        });

        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    /* typing indicator — transient, never stored */
    socket.on(SOCKET_EVENTS.CHAT_TYPING, ({ threadId, isTyping } = {}) => {
      if (!threadId) return;
      socket.to(`thread:${threadId}`).emit(SOCKET_EVENTS.CHAT_TYPING, {
        threadId,
        userId: socket.userId,
        isTyping: Boolean(isTyping),
      });
    });

    /* read receipts */
    socket.on(SOCKET_EVENTS.CHAT_READ, async ({ threadId } = {}, ack) => {
      try {
        const result = await service.markRead({ threadId, userId: socket.userId, role: socket.role });
        socket.to(`thread:${threadId}`).emit(SOCKET_EVENTS.CHAT_READ, {
          threadId,
          readerId: socket.userId,
          at: new Date(),
        });
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    socket.on('disconnect', () => logger.debug(`[chat] disconnected: ${socket.id}`));
  });
};

module.exports.getChatNamespace = () => namespaceRef;
