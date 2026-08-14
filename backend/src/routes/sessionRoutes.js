const express = require('express');
const router = express.Router();
const { createSession, getSessionDetails } = require('../controllers/sessionController');

// POST /api/sessions
router.post('/', createSession);

// GET /api/sessions/:sessionId
router.get('/:sessionId', getSessionDetails);

module.exports = router;
