/**
 * TARIFF VALIDATOR — OWNER: Gourob Gupta [GG]
 */
const mongoose = require('mongoose');
const ApiError = require('../../utils/ApiError');
const { TARIFF_PERIOD } = require('../../shared/constants');

function parseEstimateBody(body = {}) {
  const details = {};
  const { propertyId, startAt, endAt } = body;

  if (!propertyId || !mongoose.isValidObjectId(propertyId)) {
    details.propertyId = 'A valid space id is required';
  }
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (!startAt || Number.isNaN(start.getTime())) details.startAt = 'A valid start time is required';
  if (!endAt || Number.isNaN(end.getTime())) details.endAt = 'A valid end time is required';
  if (!details.startAt && !details.endAt && end <= start) {
    details.endAt = 'End time must be after the start time';
  }

  const kwh = body.kwh === undefined ? undefined : Number(body.kwh);
  if (kwh !== undefined && (!Number.isFinite(kwh) || kwh < 0 || kwh > 500)) {
    details.kwh = 'Energy must be between 0 and 500 kWh';
  }

  const promoDiscountPoisha =
    body.promoDiscountPoisha === undefined ? 0 : Number(body.promoDiscountPoisha);
  if (!Number.isInteger(promoDiscountPoisha) || promoDiscountPoisha < 0) {
    details.promoDiscountPoisha = 'Discount must be a whole number of poisha';
  }

  if (Object.keys(details).length) {
    throw ApiError.badRequest('Check the estimate details', undefined, details);
  }
  return { propertyId, startAt: start, endAt: end, kwh, promoDiscountPoisha };
}

function parseSlabsBody(body = {}) {
  const { version, slabs, note } = body;

  if (!version || !/^[\w.-]{3,20}$/.test(String(version))) {
    throw ApiError.badRequest('Give the rate set a version', undefined, {
      version: 'Use something like 2026-01 (3-20 letters, numbers, dots or dashes)',
    });
  }
  if (!Array.isArray(slabs) || !slabs.length) {
    throw ApiError.badRequest('Provide at least one rate slab', undefined, {
      slabs: 'A rate set needs at least one slab',
    });
  }

  const cleaned = slabs.map((s, i) => {
    const period = String(s.period || '').toUpperCase();
    const startHour = Number(s.startHour);
    const endHour = Number(s.endHour);
    const poishaPerKwh = Number(s.poishaPerKwh);

    if (!Object.values(TARIFF_PERIOD).includes(period)) {
      throw ApiError.badRequest('Unknown tariff period', undefined, {
        [`slabs.${i}.period`]: `Must be one of: ${Object.values(TARIFF_PERIOD).join(', ')}`,
      });
    }
    if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
      throw ApiError.badRequest('Invalid slab start hour', undefined, {
        [`slabs.${i}.startHour`]: 'Use an hour between 0 and 23',
      });
    }
    if (!Number.isInteger(endHour) || endHour <= startHour || endHour > 24) {
      throw ApiError.badRequest('Invalid slab end hour', undefined, {
        [`slabs.${i}.endHour`]: 'End hour must be after the start hour and at most 24',
      });
    }
    if (!Number.isInteger(poishaPerKwh) || poishaPerKwh < 0) {
      throw ApiError.badRequest('Invalid rate', undefined, {
        [`slabs.${i}.poishaPerKwh`]: 'Use a whole number of poisha per kWh',
      });
    }
    return { period, startHour, endHour, poishaPerKwh, label: s.label || null };
  });

  // The 24-hour day must be covered exactly once — a gap silently prices
  // energy at zero, an overlap double-charges.
  const covered = new Array(24).fill(0);
  cleaned.forEach((s) => {
    for (let h = s.startHour; h < s.endHour; h += 1) covered[h] += 1;
  });
  const gaps = covered.map((c, h) => (c === 0 ? h : null)).filter((h) => h !== null);
  const overlaps = covered.map((c, h) => (c > 1 ? h : null)).filter((h) => h !== null);

  if (gaps.length) {
    throw ApiError.badRequest(`No rate covers hour ${gaps[0]}:00`, undefined, {
      slabs: `Hours ${gaps.join(', ')} have no rate. The slabs must cover all 24 hours.`,
    });
  }
  if (overlaps.length) {
    throw ApiError.badRequest(`Two rates both cover hour ${overlaps[0]}:00`, undefined, {
      slabs: `Hours ${overlaps.join(', ')} are covered twice.`,
    });
  }

  return { version: String(version), slabs: cleaned, note: note || null };
}

module.exports = { parseEstimateBody, parseSlabsBody };
