const express = require('express');
const router = express.Router();
const Slot = require('../models/Slot');

// ─────────────────────────────────────────────────────────────
// MODULE 1: Real-Time Interactive Geospatial Search Matrix
// MongoDB 2dsphere index + $geoNear aggregation.
// ─────────────────────────────────────────────────────────────

// GET /api/search/nearby?lat=..&lng=..&radiusKm=3&propertyType=Residential
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radiusKm = 5, propertyType } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'lat and lng query params are required.' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusMeters = Math.min(parseFloat(radiusKm), 5) * 1000; // cap at 5km per proposal spec

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return res.status(400).json({ success: false, message: 'lat/lng must be valid numbers.' });
    }

    const matchStage = { isAvailable: true };
    if (propertyType) matchStage.propertyType = propertyType;

    const slots = await Slot.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [longitude, latitude] },
          distanceField: 'distanceMeters',
          maxDistance: radiusMeters,
          spherical: true,
          query: matchStage,
        },
      },
      { $sort: { distanceMeters: 1 } },
      { $limit: 50 },
    ]);

    res.json({ success: true, count: slots.length, data: slots });
  } catch (err) {
    console.error('Geospatial search error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/search/slots — create a listing (used to seed test data)
router.post('/slots', async (req, res) => {
  try {
    const { hostId, propertyType, title, address, latitude, longitude, pricePerHour, chargerType, operatingHours } = req.body;

    if (!hostId || !propertyType || !title || !address || latitude == null || longitude == null || !pricePerHour) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const slot = await Slot.create({
      hostId,
      propertyType,
      title,
      address,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      pricePerHour,
      chargerType,
      ...(operatingHours && { operatingHours }),
    });

    res.status(201).json({ success: true, message: 'Slot created.', data: slot });
  } catch (err) {
    console.error('Create slot error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
