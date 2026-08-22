/**
 * PROPERTY FILTER SERVICE — OWNER: Tamal Deb Nath [TDN]
 * Residential vs Commercial Mall filtering by MongoDB string match on
 * `propertyType`, plus the facet counts that drive the toggle's badges.
 */
const { Property } = require('../../models');
const { PROPERTY_TYPE, VERIFICATION_STATUS } = require('../../shared/constants');

const SORTS = {
  recent: { publishedAt: -1, createdAt: -1 },
  price_asc: { pricePerHourPoisha: 1 },
  price_desc: { pricePerHourPoisha: -1 },
  rating: { avgRating: -1, ratingCount: -1 },
};

/** Builds the match stage. `propertyType: "MALL"` is the string match itself. */
function buildMatch({ propertyType, hasCharger, search }) {
  const match = { isPublished: true };
  if (propertyType) match.propertyType = propertyType;
  if (hasCharger !== undefined) match.hasCharger = hasCharger;
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [{ title: rx }, { 'address.area': rx }, { 'address.line1': rx }];
  }
  return match;
}

async function listProperties(filters) {
  const match = buildMatch(filters);

  const [items, total] = await Promise.all([
    Property.find(match)
      .sort(SORTS[filters.sort])
      .skip(filters.skip)
      .limit(filters.limit)
      .populate('hostId', 'name businessName avgRating ratingCount verificationStatus')
      .lean(),
    Property.countDocuments(match),
  ]);

  return {
    items: items.map((p) => ({
      ...p,
      lng: p.location?.coordinates?.[0] ?? null,
      lat: p.location?.coordinates?.[1] ?? null,
      isMall: p.propertyType === PROPERTY_TYPE.MALL,
    })),
    page: filters.page,
    limit: filters.limit,
    total,
    pages: Math.ceil(total / filters.limit) || 1,
    appliedFilter: filters.propertyType || 'ALL',
  };
}

/**
 * Counts per category for the toggle badges: "Residential 42 · Mall 11".
 * Optionally scoped to a radius so the badges match what's on the map.
 */
async function getCategoryCounts({ lat, lng, radiusKm } = {}) {
  const geoScoped = Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radiusKm);

  const pipeline = geoScoped
    ? [
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            distanceField: 'distanceMeters',
            maxDistance: radiusKm * 1000,
            spherical: true,
            query: { isPublished: true },
            key: 'location',
          },
        },
      ]
    : [{ $match: { isPublished: true } }];

  pipeline.push({
    $group: {
      _id: '$propertyType',
      count: { $sum: 1 },
      withCharger: { $sum: { $cond: ['$hasCharger', 1, 0] } },
      minPricePoisha: { $min: '$pricePerHourPoisha' },
      maxPricePoisha: { $max: '$pricePerHourPoisha' },
      avgRating: { $avg: '$avgRating' },
    },
  });

  const rows = await Property.aggregate(pipeline);
  const byType = Object.fromEntries(rows.map((r) => [r._id, r]));

  const shape = (type) => ({
    propertyType: type,
    count: byType[type]?.count || 0,
    withCharger: byType[type]?.withCharger || 0,
    minPricePoisha: byType[type]?.minPricePoisha ?? null,
    maxPricePoisha: byType[type]?.maxPricePoisha ?? null,
    avgRating: byType[type]?.avgRating ? Number(byType[type].avgRating.toFixed(2)) : null,
  });

  const residential = shape(PROPERTY_TYPE.RESIDENTIAL);
  const mall = shape(PROPERTY_TYPE.MALL);

  return {
    scope: geoScoped ? { lat, lng, radiusKm } : 'ALL',
    all: { propertyType: 'ALL', count: residential.count + mall.count },
    residential,
    mall,
  };
}

/** Distinct amenity + connector values, so the filter bar isn't hardcoded. */
async function getFilterOptions() {
  const [amenities, connectors, priceRange] = await Promise.all([
    Property.distinct('amenities', { isPublished: true }),
    Property.distinct('chargerSpec.connectorType', { isPublished: true, hasCharger: true }),
    Property.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: null, min: { $min: '$pricePerHourPoisha' }, max: { $max: '$pricePerHourPoisha' } } },
    ]),
  ]);

  return {
    propertyTypes: [
      { value: 'ALL', label: 'All spaces' },
      { value: PROPERTY_TYPE.RESIDENTIAL, label: 'Residential' },
      { value: PROPERTY_TYPE.MALL, label: 'Commercial mall' },
    ],
    amenities: amenities.filter(Boolean).sort(),
    connectorTypes: connectors.filter(Boolean).sort(),
    priceRangePoisha: priceRange[0]
      ? { min: priceRange[0].min, max: priceRange[0].max }
      : { min: 0, max: 0 },
    verificationRequired: VERIFICATION_STATUS.APPROVED,
  };
}

module.exports = { listProperties, getCategoryCounts, getFilterOptions, buildMatch };
