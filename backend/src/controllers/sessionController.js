const mongoose = require('mongoose');
const Session = require('../models/Session');
const Host = require('../models/Host');

/**
 * POST /api/sessions
 * Creates a new charging/parking session between a driver and a host.
 */
exports.createSession = async (req, res) => {
  try {
    const { driverId, hostId, startTime, endTime, energyConsumedKwh, totalCost, status } = req.body;

    if (!driverId || !hostId || !startTime) {
      return res.status(400).json({
        success: false,
        message: 'driverId, hostId, and startTime are required.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(driverId) || !mongoose.Types.ObjectId.isValid(hostId)) {
      return res.status(400).json({
        success: false,
        message: 'driverId and hostId must be valid ObjectIds.',
      });
    }

    const host = await Host.findById(hostId);
    if (!host) {
      return res.status(404).json({ success: false, message: 'Host not found.' });
    }

    const session = await Session.create({
      driverId,
      hostId,
      startTime,
      endTime,
      energyConsumedKwh,
      totalCost,
      status: status || 'PENDING',
    });

    return res.status(201).json({
      success: true,
      message: 'Session created successfully.',
      data: session,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('createSession error:', error);
    return res.status(500).json({ success: false, message: 'Server error while creating session.' });
  }
};

/**
 * GET /api/sessions/:sessionId
 * Returns full details of a single session, including host + basic
 * feedback-eligibility status (useful for the frontend to decide whether
 * to show the Feedback Matrix modal).
 */
exports.getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ success: false, message: 'Invalid sessionId.' });
    }

    const session = await Session.findById(sessionId)
      .populate('hostId', 'name propertyName propertyType averageRating')
      .lean();

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...session,
        canSubmitFeedback: session.status === 'COMPLETED' && !session.feedbackSubmitted,
      },
    });
  } catch (error) {
    console.error('getSessionDetails error:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching session.' });
  }
};
