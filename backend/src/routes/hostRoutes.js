const express = require('express');
const router = express.Router();
const { createHost, getHostRating } = require('../controllers/hostController');

// POST /api/hosts
router.post('/', createHost);

// GET /api/hosts/:hostId
router.get('/:hostId', getHostRating);

module.exports = router;
