/**
 * HEALTH — 🔒 DO NOT EDIT.
 * Point UptimeRobot / cron-job.org at GET /api/health every 10 minutes so the
 * free Render instance never sleeps. If it sleeps, [SMR]'s penalty cron stops
 * firing and [MI]'s sockets drop. See Phase 1 plan §1.4.
 */
const router = require('express').Router();
const mongoose = require('mongoose');

router.get('/', (_req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    success: true,
    data: {
      status: 'up',
      uptimeSeconds: Math.floor(process.uptime()),
      db: states[mongoose.connection.readyState] || 'unknown',
      timestamp: new Date().toISOString(),
    },
    message: 'OK',
  });
});

module.exports = router;
