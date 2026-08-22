/**
 * ============================================================================
 * 🔒 EXPRESS APP — DO NOT EDIT AFTER INITIAL SETUP
 * ============================================================================
 * ONE Express app for the whole team. All 16 member features are routers
 * mounted inside it (see routes/index.js), not separate servers.
 * ============================================================================
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1); // Render sits behind a proxy

/* ---------------------------------------------------------------- security */
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(
  cors({
    origin(origin, callback) {
      // allow same-origin / curl / server-to-server (no Origin header)
      if (!origin) return callback(null, true);
      if (env.CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin ${origin}`));
    },
    credentials: true,
  })
);

/* ----------------------------------------------------------------- parsing */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

/* ----------------------------------------------------------------- logging */
if (env.isDev) app.use(morgan(env.LOG_LEVEL));

/* ------------------------------------------------------------------ static */
// Uploaded host documents / invoices in local dev. On Render the disk is
// ephemeral — [SMR] should move uploads to Cloudinary before submission.
app.use('/uploads', express.static('uploads'));

/* ------------------------------------------------------------------ routes */
app.get('/', (_req, res) =>
  res.json({ success: true, data: { name: 'ParkShare & Charge API', env: env.NODE_ENV }, message: 'OK' })
);
app.use('/api', routes);

/* ------------------------------------------------------------------ errors */
app.use(notFound);
app.use(errorHandler);

module.exports = app;
