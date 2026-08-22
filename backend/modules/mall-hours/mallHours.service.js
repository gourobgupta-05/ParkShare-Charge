/**
 * ============================================================================
 * MALL OPERATING HOURS SERVICE — OWNER: Tamal Deb Nath [TDN]
 * ============================================================================
 * Rejects bookings that run past a mall's closing time.
 *
 * TIMEZONE: bookings are stored in UTC. `operatingHours.openMinute` and
 * `closeMinute` are minutes from midnight in **Asia/Dhaka local time**.
 * Bangladesh is a fixed UTC+6 with no daylight saving, so the conversion is a
 * constant offset — no date library needed, and no DST edge cases.
 * ============================================================================
 */
const { Property } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { PROPERTY_TYPE, ERROR_CODES } = require('../../shared/constants');

const DHAKA_OFFSET_MINUTES = 360; // UTC+6, fixed year-round

/* -------------------------------------------------------------- helpers -- */

/** UTC Date → minutes from midnight in Dhaka local time (0–1439). */
function toDhakaMinutes(date) {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (utcMinutes + DHAKA_OFFSET_MINUTES) % 1440;
}

/** UTC Date → Dhaka calendar day index (0=Sunday … 6=Saturday). */
function toDhakaDayOfWeek(date) {
  const shifted = new Date(date.getTime() + DHAKA_OFFSET_MINUTES * 60000);
  return shifted.getUTCDay();
}

/** 615 → "10:15". */
function minutesToLabel(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "10:15" | "1015" | 615 → 615. Returns null when unparseable. */
function labelToMinutes(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59) return null;
  return h * 60 + m;
}

/** Does this booking cross a Dhaka midnight? */
function spansMidnight(startAt, endAt) {
  return toDhakaDayOfWeek(startAt) !== toDhakaDayOfWeek(endAt);
}

/* ---------------------------------------------------------------- guard -- */

/**
 * The core check. Pure function — takes a property document and a window,
 * returns a verdict. No database access, so it is trivially testable and can
 * be reused by [GG]'s calendar before a booking is even created.
 *
 * @returns {{allowed: boolean, reason: string|null, code: string|null, hours: object}}
 */
function evaluateWindow(property, startAt, endAt) {
  const hours = property.operatingHours || {};
  const info = {
    propertyType: property.propertyType,
    is24x7: Boolean(hours.is24x7),
    opens: minutesToLabel(hours.openMinute ?? 0),
    closes: minutesToLabel(hours.closeMinute ?? 1440),
  };

  // Residential hosts set their availability through [GG]'s calendar, not
  // through mall opening hours. This guard only applies to commercial malls.
  if (property.propertyType !== PROPERTY_TYPE.MALL) {
    return { allowed: true, reason: null, code: null, hours: info };
  }

  if (hours.is24x7) {
    return { allowed: true, reason: null, code: null, hours: info };
  }

  const open = hours.openMinute ?? 0;
  const close = hours.closeMinute ?? 1440;

  const startMin = toDhakaMinutes(startAt);
  // A booking that ends exactly at midnight reads as minute 0; treat as 1440
  // so "22:00 → 00:00" is measured against the closing time correctly.
  const rawEnd = toDhakaMinutes(endAt);
  const endMin = rawEnd === 0 ? 1440 : rawEnd;

  if (spansMidnight(startAt, endAt) && rawEnd !== 0) {
    return {
      allowed: false,
      code: ERROR_CODES.OUTSIDE_MALL_HOURS,
      reason: `${property.title} closes at ${info.closes}. Overnight bookings are not available here.`,
      hours: info,
    };
  }

  if (startMin < open) {
    return {
      allowed: false,
      code: ERROR_CODES.OUTSIDE_MALL_HOURS,
      reason: `${property.title} opens at ${info.opens}. Choose a later start time.`,
      hours: info,
    };
  }

  if (endMin > close) {
    return {
      allowed: false,
      code: ERROR_CODES.OUTSIDE_MALL_HOURS,
      reason: `${property.title} closes at ${info.closes}. Your booking would end at ${minutesToLabel(endMin)}.`,
      hours: info,
    };
  }

  return { allowed: true, reason: null, code: null, hours: info };
}

/** Database-backed version used by routes and by the escrow hold. */
async function checkBookingWindow(propertyId, startAt, endAt) {
  const property = await Property.findById(propertyId)
    .select('title propertyType operatingHours')
    .lean();
  if (!property) throw ApiError.notFound('That space no longer exists');

  return { ...evaluateWindow(property, new Date(startAt), new Date(endAt)), property };
}

/**
 * Suggested latest end time for a given start, so the UI can offer a fix
 * instead of only saying no.
 */
function latestEndForDay(property, startAt) {
  const hours = property.operatingHours || {};
  if (property.propertyType !== PROPERTY_TYPE.MALL || hours.is24x7) return null;

  const close = hours.closeMinute ?? 1440;
  const startMin = toDhakaMinutes(startAt);
  if (startMin >= close) return null;

  const minutesAvailable = close - startMin;
  return {
    closesAt: minutesToLabel(close),
    maxDurationMinutes: minutesAvailable,
    latestEndAt: new Date(startAt.getTime() + minutesAvailable * 60000),
  };
}

/* ------------------------------------------------------- host management -- */

/** Host updates the opening hours on one of their own malls. */
async function updateOperatingHours(propertyId, hostId, payload) {
  const property = await Property.findById(propertyId);
  if (!property) throw ApiError.notFound('That space no longer exists');
  if (String(property.hostId) !== String(hostId)) {
    throw ApiError.forbidden('You can only edit opening hours on your own spaces');
  }

  const is24x7 = Boolean(payload.is24x7);
  let openMinute = property.operatingHours?.openMinute ?? 480;
  let closeMinute = property.operatingHours?.closeMinute ?? 1320;

  if (!is24x7) {
    const parsedOpen = labelToMinutes(payload.openMinute ?? payload.opens);
    const parsedClose = labelToMinutes(payload.closeMinute ?? payload.closes);

    const details = {};
    if (parsedOpen === null) details.openMinute = 'Use a time like 08:00';
    if (parsedClose === null) details.closeMinute = 'Use a time like 22:00';
    if (parsedOpen !== null && parsedClose !== null && parsedClose <= parsedOpen) {
      details.closeMinute = 'Closing time must be after the opening time';
    }
    if (Object.keys(details).length) {
      throw ApiError.badRequest('Check the opening hours', undefined, details);
    }
    openMinute = parsedOpen;
    closeMinute = parsedClose;
  }

  property.operatingHours = { is24x7, openMinute, closeMinute };
  await property.save();

  return {
    propertyId: property._id,
    title: property.title,
    propertyType: property.propertyType,
    operatingHours: property.operatingHours,
    display: is24x7 ? 'Open 24/7' : `${minutesToLabel(openMinute)} – ${minutesToLabel(closeMinute)}`,
  };
}

/** The host's own spaces, for the opening-hours editor screen. */
async function listHostProperties(hostId) {
  const properties = await Property.find({ hostId })
    .select('title propertyType operatingHours isPublished address pricePerHourPoisha')
    .sort({ createdAt: -1 })
    .lean();

  return properties.map((p) => ({
    ...p,
    display: p.operatingHours?.is24x7
      ? 'Open 24/7'
      : `${minutesToLabel(p.operatingHours?.openMinute ?? 0)} – ${minutesToLabel(p.operatingHours?.closeMinute ?? 1440)}`,
    guardApplies: p.propertyType === PROPERTY_TYPE.MALL,
  }));
}

module.exports = {
  evaluateWindow,
  checkBookingWindow,
  latestEndForDay,
  updateOperatingHours,
  listHostProperties,
  toDhakaMinutes,
  toDhakaDayOfWeek,
  minutesToLabel,
  labelToMinutes,
  DHAKA_OFFSET_MINUTES,
};
