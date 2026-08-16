const express = require('express');
const router = express.Router();
const { submitFeedback, getFeedbackByHost } = require('../controllers/feedbackController');

// POST /api/feedback
router.post('/', submitFeedback);

// GET /api/feedback/host/:hostId
router.get('/host/:hostId', getFeedbackByHost);

module.exports = router;
