/** IoT socket namespace (/iot) — STUB. OWNER: Maidul Islam [MI]. */
const logger = require('../../utils/logger');
module.exports = function registerIotNamespace(nsp) {
  nsp.on('connection', (socket) => {
    logger.debug(`[iot] connected: ${socket.id}`);
    socket.on('disconnect', () => logger.debug(`[iot] disconnected: ${socket.id}`));
  });
};
