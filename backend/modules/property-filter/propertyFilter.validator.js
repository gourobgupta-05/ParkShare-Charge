/**
 * PROPERTY FILTER VALIDATOR — OWNER: Tamal Deb Nath [TDN]
 */
const ApiError = require('../../utils/ApiError');
const { PROPERTY_TYPE } = require('../../shared/constants');

/**
 * The toggle sends 'ALL' | 'RESIDENTIAL' | 'MALL'. We also accept the loose
 * spellings a teammate or a URL might produce ('Mall', 'mall', 'Commercial').
 */
function normaliseType(raw) {
  if (raw === undefined || raw === null || raw === '' || String(raw).toUpperCase() === 'ALL') {
    return null; // null = no filter
  }
  const key = String(raw).trim().toUpperCase().replace(/\s+/g, '_');
  if (key === 'COMMERCIAL' || key === 'COMMERCIAL_MALL') return PROPERTY_TYPE.MALL;
  if (key === 'RESIDENCE' || key === 'HOME') return PROPERTY_TYPE.RESIDENTIAL;
  if (Object.values(PROPERTY_TYPE).includes(key)) return key;

  throw ApiError.badRequest('Unknown property category', undefined, {
    propertyType: `Use ALL, ${PROPERTY_TYPE.RESIDENTIAL} or ${PROPERTY_TYPE.MALL}`,
  });
}

function parseListQuery(q = {}) {
  const page = Math.max(parseInt(q.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(q.limit || '20', 10), 1), 50);
  const sort = ['recent', 'price_asc', 'price_desc', 'rating'].includes(q.sort) ? q.sort : 'recent';

  return {
    propertyType: normaliseType(q.propertyType),
    hasCharger: q.hasCharger === 'true' ? true : q.hasCharger === 'false' ? false : undefined,
    search: q.search ? String(q.search).trim().slice(0, 80) : undefined,
    page,
    limit,
    skip: (page - 1) * limit,
    sort,
  };
}

module.exports = { normaliseType, parseListQuery };
