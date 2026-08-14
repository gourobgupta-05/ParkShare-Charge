const mongoose = require('mongoose');
const Host = require('../models/Host');

/**
 * POST /api/hosts
 * Creates a new host (residential owner or mall manager).
 */
exports.createHost = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      propertyType,
      propertyName,
      address,
      longitude,
      latitude,
    } = req.body;

    if (!name || !email || !phone || !propertyType || !propertyName || !address) {
      return res.status(400).json({
        success: false,
        message: 'name, email, phone, propertyType, propertyName, and address are required.',
      });
    }

    if (!['Residential', 'Mall'].includes(propertyType)) {
      return res.status(400).json({
        success: false,
        message: 'propertyType must be either "Residential" or "Mall".',
      });
    }

    const hostData = { name, email, phone, propertyType, propertyName, address };

    if (typeof longitude === 'number' && typeof latitude === 'number') {
      hostData.location = { type: 'Point', coordinates: [longitude, latitude] };
    }

    const host = await Host.create(hostData);

    return res.status(201).json({
      success: true,
      message: 'Host created successfully.',
      data: host,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A host with this email already exists.',
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('createHost error:', error);
    return res.status(500).json({ success: false, message: 'Server error while creating host.' });
  }
};

/**
 * GET /api/hosts/:hostId
 * Returns a host's profile including their current moving-average rating.
 */
exports.getHostRating = async (req, res) => {
  try {
    const { hostId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(hostId)) {
      return res.status(400).json({ success: false, message: 'Invalid hostId.' });
    }

    const host = await Host.findById(hostId).select(
      'name propertyName propertyType averageRating totalReviews avgReliability avgSafety avgEfficiency'
    );

    if (!host) {
      return res.status(404).json({ success: false, message: 'Host not found.' });
    }

    return res.status(200).json({ success: true, data: host });
  } catch (error) {
    console.error('getHostRating error:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching host rating.' });
  }
};
