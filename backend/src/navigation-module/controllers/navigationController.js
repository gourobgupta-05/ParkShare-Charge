const navigationService = require("../services/navigationService");

async function getRoute(req, res) {
  try {
    const { originLat, originLng, destLat, destLng } = req.query;

    const origin = { lat: parseFloat(originLat), lng: parseFloat(originLng) };
    const destination = { lat: parseFloat(destLat), lng: parseFloat(destLng) };

    if (
      [origin.lat, origin.lng, destination.lat, destination.lng].some(
        (v) => Number.isNaN(v)
      )
    ) {
      return res.status(400).json({
        error:
          "originLat, originLng, destLat, destLng are required numeric query params",
      });
    }

    const route = await navigationService.getRoute({ origin, destination });
    res.json(route);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { getRoute };
