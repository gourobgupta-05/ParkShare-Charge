/**
 * ============================================================================
 * GEO PIPELINE BUILDER — OWNER: Tamal Deb Nath [TDN]
 * ============================================================================
 * Builds the MongoDB aggregation pipeline for the geospatial search matrix.
 * Kept separate from the service so the pipeline can be unit-tested and
 * inspected (GET /api/geo/search?explain=1) without hitting business logic.
 *
 * $geoNear rules that bite people:
 *   1. It MUST be the first stage in the pipeline.
 *   2. It needs a 2dsphere index on the field — Property.location has one.
 *   3. Coordinates are [longitude, latitude]. Reversed = Dhaka in the ocean.
 *   4. `query` inside $geoNear is far cheaper than a later $match, because it
 *      filters during the index scan instead of after it.
 * ============================================================================
 */
const { PROPERTY_TYPE, VERIFICATION_STATUS, BLOCKING_STATUSES, PLATFORM } = require('../../shared/constants');

/**
 * @param {object} f - normalised filters from geoSearch.validator
 * @returns {Array} aggregation pipeline
 */
function buildGeoSearchPipeline(f) {
  const {
    lng, lat, radiusKm,
    propertyType, hasCharger, connectorType,
    maxPricePoisha, minRating, amenities,
    startAt, endAt,
    sort, limit, skip,
  } = f;

  /* ------------------------------------------------------------------ 1 --
   * $geoNear — index-level filtering. Everything cheap goes in `query`.
   */
  const geoQuery = { isPublished: true };

  if (propertyType) geoQuery.propertyType = propertyType;
  if (hasCharger === true) geoQuery.hasCharger = true;
  if (connectorType) geoQuery['chargerSpec.connectorType'] = connectorType;
  if (typeof maxPricePoisha === 'number') geoQuery.pricePerHourPoisha = { $lte: maxPricePoisha };
  if (typeof minRating === 'number') geoQuery.avgRating = { $gte: minRating };
  if (amenities && amenities.length) geoQuery.amenities = { $all: amenities };

  const pipeline = [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distanceMeters',
        maxDistance: radiusKm * 1000,
        minDistance: 0,
        spherical: true,
        query: geoQuery,
        key: 'location',
      },
    },
  ];

  /* ------------------------------------------------------------------ 2 --
   * Only surface spaces whose host passed [SMR]'s verification pipeline.
   * Read-only cross-feature dependency — we never write those fields.
   */
  pipeline.push(
    {
      $lookup: {
        from: 'users',
        localField: 'hostId',
        foreignField: '_id',
        as: 'host',
        pipeline: [
          {
            $project: {
              name: 1, avgRating: 1, ratingCount: 1,
              verificationStatus: 1, propertyType: 1, businessName: 1,
            },
          },
        ],
      },
    },
    { $unwind: { path: '$host', preserveNullAndEmptyArrays: false } },
    { $match: { 'host.verificationStatus': VERIFICATION_STATUS.APPROVED } }
  );

  /* ------------------------------------------------------------------ 3 --
   * Availability for the requested window. A property is unavailable if any
   * booking in a BLOCKING status overlaps [startAt, endAt).
   * Overlap test: existing.startAt < requested.endAt AND existing.endAt > requested.startAt
   */
  if (startAt && endAt) {
    pipeline.push(
      {
        $lookup: {
          from: 'bookings',
          let: { propId: '$_id' },
          as: 'conflicts',
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$propertyId', '$$propId'] },
                    { $lt: ['$startAt', new Date(endAt)] },
                    { $gt: ['$endAt', new Date(startAt)] },
                  ],
                },
                status: { $in: BLOCKING_STATUSES },
              },
            },
            { $project: { _id: 1 } },
            { $limit: 1 },
          ],
        },
      },
      { $addFields: { isAvailable: { $eq: [{ $size: '$conflicts' }, 0] } } },
      { $match: { isAvailable: true } },
      { $project: { conflicts: 0 } }
    );
  } else {
    pipeline.push({ $addFields: { isAvailable: true } });
  }

  /* ------------------------------------------------------------------ 4 --
   * Shape the map-pin payload. Keep it small — this is fetched on every pan.
   */
  pipeline.push({
    $project: {
      title: 1,
      description: 1,
      propertyType: 1,
      address: 1,
      location: 1,
      entranceLocation: 1,
      pricePerHourPoisha: 1,
      totalSlots: 1,
      hasCharger: 1,
      chargerSpec: 1,
      operatingHours: 1,
      amenities: 1,
      photos: { $slice: ['$photos', 3] },
      avgRating: 1,
      ratingCount: 1,
      distanceMeters: { $round: ['$distanceMeters', 0] },
      isAvailable: 1,
      host: 1,
      // Convenience for Mapbox — GeoJSON order is [lng, lat]
      lng: { $arrayElemAt: ['$location.coordinates', 0] },
      lat: { $arrayElemAt: ['$location.coordinates', 1] },
      isMall: { $eq: ['$propertyType', PROPERTY_TYPE.MALL] },
    },
  });

  /* ------------------------------------------------------------------ 5 --
   * Sort. $geoNear already returns nearest-first, so only re-sort if asked.
   */
  const SORTS = {
    distance: null, // already sorted by $geoNear
    price_asc: { pricePerHourPoisha: 1, distanceMeters: 1 },
    price_desc: { pricePerHourPoisha: -1, distanceMeters: 1 },
    rating: { avgRating: -1, ratingCount: -1, distanceMeters: 1 },
  };
  if (SORTS[sort]) pipeline.push({ $sort: SORTS[sort] });

  if (skip) pipeline.push({ $skip: skip });
  pipeline.push({ $limit: Math.min(limit || 50, PLATFORM.SEARCH_MAX_RESULTS || 50) });

  return pipeline;
}

/**
 * Lightweight pipeline for map pins inside the current viewport (bounding box).
 * Uses $geoWithin rather than $geoNear because we don't need distances here,
 * and $geoWithin is cheaper when panning the map.
 */
function buildViewportPipeline({ swLng, swLat, neLng, neLat, propertyType, limit = 200 }) {
  const match = {
    isPublished: true,
    location: {
      $geoWithin: {
        $box: [
          [swLng, swLat],
          [neLng, neLat],
        ],
      },
    },
  };
  if (propertyType) match.propertyType = propertyType;

  return [
    { $match: match },
    {
      $project: {
        title: 1,
        propertyType: 1,
        pricePerHourPoisha: 1,
        hasCharger: 1,
        avgRating: 1,
        lng: { $arrayElemAt: ['$location.coordinates', 0] },
        lat: { $arrayElemAt: ['$location.coordinates', 1] },
      },
    },
    { $limit: limit },
  ];
}

module.exports = { buildGeoSearchPipeline, buildViewportPipeline };
