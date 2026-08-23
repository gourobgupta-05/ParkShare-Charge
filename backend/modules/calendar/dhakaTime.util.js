/**
 * DHAKA TIME UTILITIES — OWNER: Gourob Gupta [GG]
 *
 * Bookings are stored in UTC. Availability rules and blackout dates are
 * expressed in Asia/Dhaka local time, which is a fixed UTC+6 with no daylight
 * saving — so every conversion here is a constant offset, no date library.
 *
 * Kept local to this module rather than imported from another member's folder,
 * so the calendar never breaks because someone else refactored their helper.
 */
const DHAKA_OFFSET_MINUTES = 360; // UTC+6

/** UTC Date -> minutes from midnight, Dhaka local (0-1439). */
function toDhakaMinutes(date) {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (utcMinutes + DHAKA_OFFSET_MINUTES) % 1440;
}

/** UTC Date -> Dhaka weekday (0 = Sunday ... 6 = Saturday). */
function toDhakaDayOfWeek(date) {
  return new Date(date.getTime() + DHAKA_OFFSET_MINUTES * 60000).getUTCDay();
}

/** UTC Date -> 'YYYY-MM-DD' as seen in Dhaka. */
function toDhakaDateString(date) {
  return new Date(date.getTime() + DHAKA_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' + minutes-from-midnight (Dhaka) -> UTC Date. */
function dhakaToUtc(dateString, minutes = 0) {
  const [y, m, d] = String(dateString).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) + (minutes - DHAKA_OFFSET_MINUTES) * 60000);
}

/** 615 -> '10:15' */
function minutesToLabel(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** '10:15' | 615 -> 615, or null when unparseable. */
function labelToMinutes(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/** Is this UTC instant on a blackout date (compared in Dhaka calendar days)? */
function isBlackout(date, blackoutDates = []) {
  const target = toDhakaDateString(date);
  return blackoutDates.some((b) => toDhakaDateString(new Date(b)) === target);
}

module.exports = {
  DHAKA_OFFSET_MINUTES,
  toDhakaMinutes,
  toDhakaDayOfWeek,
  toDhakaDateString,
  dhakaToUtc,
  minutesToLabel,
  labelToMinutes,
  isBlackout,
};
