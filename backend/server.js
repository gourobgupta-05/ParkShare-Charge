/**
 * ============================================================================
 * 🔒 SERVER ENTRY POINT — DO NOT EDIT AFTER INITIAL SETUP
 * ============================================================================
 * Boots one HTTP server: Express REST API + socket.io realtime.
 * Render start command:  node backend/server.js
 * ============================================================================
 */
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);


const http = require('http');
const mongoose = require('mongoose');

const env = require('./config/env');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');
const app = require('./app');
const { initRealtime } = require('./realtime');

let server;

async function start() {
  await connectDB();

  server = http.createServer(app);
  initRealtime(server);

  server.listen(env.PORT, () => {
    logger.info(`ParkShare & Charge API listening on :${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`CORS allows: ${env.CORS_ORIGINS.join(', ')}`);
    if (env.isProd) {
      logger.warn(
        'Render free tier sleeps after ~15 min idle. Ping /api/health every 10 min ' +
          'or the penalty worker and sockets will stop.'
      );
    }
  });
}

async function shutdown(signal) {
  logger.warn(`${signal} received — shutting down`);
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.close(false);
  logger.info('Closed cleanly');
  process.exit(0);
}

['SIGTERM', 'SIGINT'].forEach((sig) => process.on(sig, () => shutdown(sig)));

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled rejection: ${err?.message}\n${err?.stack}`);
});
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err?.message}\n${err?.stack}`);
  process.exit(1);
});

start().catch((err) => {
  logger.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
