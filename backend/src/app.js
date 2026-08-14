const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const hostRoutes = require('./routes/hostRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const navigationRoutes = require('./navigation-module/routes/navigationRoutes'); //Maidul

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'ParkShare & Charge API (Gourob Gupta - Module 1) is running.' });
});

// Gourob Gupta — Module 1 (F1: Driver-Side Post-Session Feedback & Verification Matrix)
app.use('/api/hosts', hostRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/feedback', feedbackRoutes);

// Maidul Islam – Module 1 (F1: Turn-by-Turn Smart In-App Navigation Engine)
app.use('/api/navigation', navigationRoutes);
// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

module.exports = app;
