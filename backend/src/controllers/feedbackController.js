const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const Host = require('../models/Host');
const Session = require('../models/Session');

/**
 * Recalculates a host's moving-average rating across ALL their feedback
 * submissions and writes it back onto the Host document.
 *
 * Uses a MongoDB aggregation pipeline ($match + $group) rather than
 * pulling every feedback doc into Node and averaging in memory — this
 * scales correctly as review volume grows and stays consistent with the
 * PDF spec's "recalculating and updating the host's moving-average
 * profile rating inside MongoDB."
 */
async function recalculateHostRating(hostId) {
  const stats = await Feedback.aggregate([
    { $match: { hostId: new mongoose.Types.ObjectId(hostId) } },
    {
      $group: {
        _id: '$hostId',
        avgOverall: { $avg: '$overallRating' },
        avgReliability: { $avg: '$ratingReliability' },
        avgSafety: { $avg: '$ratingSafety' },
        avgEfficiency: { $avg: '$ratingEfficiency' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const summary = stats[0] || {
    avgOverall: 0,
    avgReliability: 0,
    avgSafety: 0,
    avgEfficiency: 0,
    totalReviews: 0,
  };

  const round1 = (n) => Math.round((n || 0) * 10) / 10;

  const updatedHost = await Host.findByIdAndUpdate(
    hostId,
    {
      $set: {
        averageRating: round1(summary.avgOverall),
        totalReviews: summary.totalReviews,
        avgReliability: round1(summary.avgReliability),
        avgSafety: round1(summary.avgSafety),
        avgEfficiency: round1(summary.avgEfficiency),
      },
    },
    { new: true }
  );

  return updatedHost;
}

/**
 * POST /api/feedback
 * Creates a post-session feedback submission and triggers the host's
 * moving-average rating recalculation.
 */
exports.submitFeedback = async (req, res) => {
  try {
    const {
      sessionId,
      driverId,
      hostId,
      ratingReliability,
      ratingSafety,
      ratingEfficiency,
      comment,
    } = req.body;

    // --- Basic payload validation ---
    if (!sessionId || !driverId || !hostId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId, driverId, and hostId are required.',
      });
    }
    if (
      !mongoose.Types.ObjectId.isValid(sessionId) ||
      !mongoose.Types.ObjectId.isValid(driverId) ||
      !mongoose.Types.ObjectId.isValid(hostId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'sessionId, driverId, and hostId must be valid ObjectIds.',
      });
    }
    for (const [label, val] of Object.entries({
      ratingReliability,
      ratingSafety,
      ratingEfficiency,
    })) {
      if (typeof val !== 'number' || val < 1 || val > 5) {
        return res.status(400).json({
          success: false,
          message: `${label} must be a number between 1 and 5.`,
        });
      }
    }

    // --- Enforce: feedback only allowed on a COMPLETED session ---
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }
    if (session.status !== 'COMPLETED') {
      return res.status(409).json({
        success: false,
        message: 'Feedback can only be submitted for completed sessions.',
      });
    }
    if (session.feedbackSubmitted) {
      return res.status(409).json({
        success: false,
        message: 'Feedback has already been submitted for this session.',
      });
    }
    if (String(session.driverId) !== String(driverId)) {
      return res.status(403).json({
        success: false,
        message: 'This session does not belong to the given driver.',
      });
    }
    if (String(session.hostId) !== String(hostId)) {
      return res.status(400).json({
        success: false,
        message: 'hostId does not match the host on this session.',
      });
    }

    // --- Create the feedback (unique index blocks duplicate submissions) ---
    const feedback = await Feedback.create({
      sessionId,
      driverId,
      hostId,
      ratingReliability,
      ratingSafety,
      ratingEfficiency,
      comment,
    });

    // --- Recalculate host's moving-average rating ---
    const updatedHost = await recalculateHostRating(hostId);

    // --- Mark session as reviewed so it can't be double-submitted ---
    session.feedbackSubmitted = true;
    await session.save();

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully.',
      data: {
        feedback,
        hostRating: updatedHost
          ? {
              averageRating: updatedHost.averageRating,
              totalReviews: updatedHost.totalReviews,
            }
          : null,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Feedback for this session has already been submitted.',
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('submitFeedback error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while submitting feedback.',
    });
  }
};

/**
 * GET /api/feedback/host/:hostId
 * Fetches all feedback submissions for a given host (host dashboards,
 * public profile pages, etc.), most recent first.
 */
exports.getFeedbackByHost = async (req, res) => {
  try {
    const { hostId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(hostId)) {
      return res.status(400).json({ success: false, message: 'Invalid hostId.' });
    }

    const feedback = await Feedback.find({ hostId })
      .sort({ createdAt: -1 })
      .populate('driverId', 'name');

    return res.status(200).json({ success: true, count: feedback.length, data: feedback });
  } catch (error) {
    console.error('getFeedbackByHost error:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching feedback.' });
  }
};

exports._recalculateHostRating = recalculateHostRating; // exported for unit tests
