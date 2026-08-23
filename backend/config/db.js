/**
 * 🔒 DO NOT EDIT AFTER INITIAL SETUP.
 * Mongoose connection. Warns if the cluster is NOT a replica set, because the
 * escrow [TDN] and split-payout [SMR] features require multi-document ACID
 * transactions, which a standalone mongod cannot do. Use MongoDB Atlas M0.
 */
const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

async function connectDB() {
  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(env.MONGO_URI, {
    dbName: env.MONGO_DB_NAME,
    serverSelectionTimeoutMS: 15000,
  });

  logger.info(`MongoDB connected → ${conn.connection.host}/${conn.connection.name}`);

  try {
    const admin = conn.connection.db.admin();
    const info = await admin.command({ hello: 1 });
    if (!info.setName) {
      logger.warn(
        'This MongoDB deployment is NOT a replica set. Transactions will FAIL. ' +
          'Escrow and split-payout need MongoDB Atlas (free M0 is a replica set).'
      );
    }
  } catch {
    /* admin command not permitted on some shared tiers — safe to ignore */
  }

  mongoose.connection.on('error', (err) => logger.error('MongoDB error: ' + err.message));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  return conn;
}

module.exports = { connectDB };
