/**
 * 🔒 DO NOT EDIT AFTER INITIAL SETUP.
 * Loads .env, validates that required variables exist, and CRASHES LOUDLY if
 * one is missing. A silent `undefined` config is the worst bug to debug at 3am.
 */
require('dotenv').config();

const REQUIRED = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('\n❌ Missing required environment variables:\n   - ' + missing.join('\n   - '));
  console.error('\n   Copy backend/.env.example to backend/.env and fill it in.\n');
  process.exit(1);
}

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGO_URI: process.env.MONGO_URI,
  MONGO_DB_NAME: process.env.MONGO_DB_NAME || undefined,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL || '2h',
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL || '30d',
  QR_PASS_SECRET: process.env.QR_PASS_SECRET || process.env.JWT_ACCESS_SECRET,
  QR_PASS_TTL_MIN: parseInt(process.env.QR_PASS_TTL_MIN || '15', 10),

  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  LOG_LEVEL: process.env.LOG_LEVEL || 'dev',

  // Provider switches — see Phase 1 plan §1.6
  SMS_PROVIDER: process.env.SMS_PROVIDER || 'mock',
  PUSH_PROVIDER: process.env.PUSH_PROVIDER || 'mock',
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER || 'mock',
};

env.isProd = env.NODE_ENV === 'production';
env.isDev = !env.isProd;

module.exports = env;
