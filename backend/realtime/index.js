/**
 * 🔒 REALTIME REGISTRY — DO NOT EDIT AFTER INITIAL SETUP.
 * Creates the socket.io server, authenticates every connection with the same
 * JWT used by the REST API, and hands each namespace to its owner's handler.
 * [MI] edits the handler files, never this file.
 */
const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../utils/logger');
const { verifyAccessToken } = require('../utils/token');
const { SOCKET_NAMESPACES } = require('../shared/constants');

const registerIotNamespace = require('../modules/iot-grid/iot.socket');
const registerChatNamespace = require('../modules/chat/chat.socket');

/** Attaches socket.userId / socket.role, or rejects the handshake. */
function socketAuth(socket, next) {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.query?.token ||
    (socket.handshake.headers.authorization || '').replace('Bearer ', '');

  if (!token) return next(new Error('UNAUTHORIZED'));
  try {
    const payload = verifyAccessToken(token);
    socket.userId = payload.sub;
    socket.role = payload.role;
    return next();
  } catch {
    return next(new Error('UNAUTHORIZED'));
  }
}

function initRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    path: process.env.SOCKET_PATH || '/socket.io',
  });

  const iot = io.of(SOCKET_NAMESPACES.IOT);
  iot.use(socketAuth);
  registerIotNamespace(iot);

  const chat = io.of(SOCKET_NAMESPACES.CHAT);
  chat.use(socketAuth);
  registerChatNamespace(chat);

  logger.info(`Realtime ready → ${SOCKET_NAMESPACES.IOT}, ${SOCKET_NAMESPACES.CHAT}`);
  return io;
}

module.exports = { initRealtime };
