/** Chat socket namespace (/chat) — STUB. OWNER: Maidul Islam [MI]. */
const logger = require('../../utils/logger');
module.exports = function registerChatNamespace(nsp) {
  nsp.on('connection', (socket) => {
    logger.debug(`[chat] connected: ${socket.id}`);
    socket.on('disconnect', () => logger.debug(`[chat] disconnected: ${socket.id}`));
  });
};
