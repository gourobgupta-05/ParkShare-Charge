/**
 * ============================================================================
 * BERC TARIFF SERVICE — OWNER: Gourob Gupta [GG]
 * ============================================================================
 * Prices a charging session against Bangladesh Energy Regulatory Commission
 * time-of-use slabs.
 *
 * HOW THE SPLIT WORKS
 * A session that runs 16:00 → 19:00 straddles the daytime and evening-peak
 * slabs. Energy is apportioned by how many minutes fall in each slab, then
 * each portion is charged at that slab's rate. Charging is assumed to draw
 * evenly across the session, which is the standard simplification for
 * time-of-use billing without per-minute meter data.
 *
 * ON TOP OF THE BERC RATE
 *   + host overhead   (property.chargerSpec.overheadPoishaPerKwh) — the host's
 *                     own wiring/maintenance margin
 *   × platform multiplier (PlatformConfig.tariffMultiplier) — admin-tunable
 *
 * Everything is an integer in poisha. Rounding always goes through
 * Math.ceil at slab level so the platform never under-collects by a fraction.
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Property, Booking, Session, PlatformConfig } = require('../../models');
const BercRate = require('./bercRate.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { percentOf } = require('../../utils/money');
const { PLATFORM, TARIFF_PERIOD, BERC_SLABS } = require('../../shared/constants');
const T = require('../calendar/dhakaTime.util');

const SEED_PATH = path.join(__dirname, 'berc.rates.seed.json');

/* ------------------------------------------------------------------------ */
/* Rate sets                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Active slabs, in priority order:
 *   1. the BercRate document flagged isActive
 *   2. the bundled seed JSON
 *   3. BERC_SLABS in shared/constants (last-resort default)
 * This means the tariff engine works on a fresh database with no seeding.
 */
async function getActiveRates() {
  const active = await BercRate.findOne({ isActive: true }).lean();
  if (active) return { version: active.version, slabs: active.slabs, source: 'database' };

  try {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    return { version: seed.version, slabs: seed.slabs, source: 'seed-file' };
  } catch {
    logger.warn('[tariff] seed file unreadable, falling back to shared constants');
    return { version: 'constants', slabs: BERC_SLABS, source: 'constants' };
  }
}

/** Rate for a given Dhaka hour. */
function slabForHour(slabs, hour) {
  return slabs.find((s) => hour >= s.startHour && hour < s.endHour) || null;
}

/* ------------------------------------------------------------------------ */
/* Core calculation                                                         */
/* ------------------------------------------------------------------------ */

/**
 * Splits a window into per-slab minute buckets.
 * Pure function — no database access, so it is trivially testable.
 *
 * @returns {{ totalMinutes: number, buckets: Array }}
 */
function splitByPeriod(startAt, endAt, slabs) {
  const totalMinutes = Math.max(Math.round((endAt - startAt) / 60000), 0);
  const byPeriod = new Map();

  // Walk minute by minute in Dhaka local time. A 12-hour maximum booking is
  // 720 iterations, which is nothing, and it removes every edge case around
  // midnight and slab boundaries.
  for (let i = 0; i < totalMinutes; i += 1) {
    const instant = new Date(startAt.getTime() + i * 60000);
    const hour = Math.floor(T.toDhakaMinutes(instant) / 60);
    const slab = slabForHour(slabs, hour);
    const period = slab?.period || TARIFF_PERIOD.STANDARD;
    const rate = slab?.poishaPerKwh ?? 0;

    const key = `${period}:${rate}`;
    const bucket = byPeriod.get(key) || { period, poishaPerKwh: rate, minutes: 0, label: slab?.label || null };
    bucket.minutes += 1;
    byPeriod.set(key, bucket);
  }

  return { totalMinutes, buckets: [...byPeriod.values()] };
}

/**
 * The full price breakdown.
 *
 * @param {object} p
 * @param {object} p.property   - needs pricePerHourPoisha + chargerSpec
 * @param {Date}   p.startAt
 * @param {Date}   p.endAt
 * @param {number} [p.kwh]      - measured energy; omit to estimate from charger kW
 * @param {number} [p.promoDiscountPoisha]
 * @param {object} p.rates      - from getActiveRates()
 * @param {object} p.config     - PlatformConfig document
 */
function calculate({ property, startAt, endAt, kwh, promoDiscountPoisha = 0, rates, config }) {
  const { totalMinutes, buckets } = splitByPeriod(startAt, endAt, rates.slabs);
  const hours = totalMinutes / 60;

  /* -------------------------------------------------------- parking fee -- */
  const basePoisha = Math.ceil((property.pricePerHourPoisha * totalMinutes) / 60);

  /* ------------------------------------------------------------- energy -- */
  const chargerKw = property.chargerSpec?.kw || 0;
  const overheadPoishaPerKwh = property.chargerSpec?.overheadPoishaPerKwh || 0;
  const multiplier = config?.tariffMultiplier ?? 1;

  // Measured energy wins; otherwise assume the charger runs at its rated kW.
  const estimatedKwh = Number.isFinite(kwh) ? Number(kwh) : Number((chargerKw * hours).toFixed(3));

  let energyPoisha = 0;
  const periodLines = buckets.map((b) => {
    const share = totalMinutes ? b.minutes / totalMinutes : 0;
    const periodKwh = Number((estimatedKwh * share).toFixed(3));
    const effectiveRate = Math.ceil((b.poishaPerKwh + overheadPoishaPerKwh) * multiplier);
    const linePoisha = Math.ceil(periodKwh * effectiveRate);
    energyPoisha += linePoisha;

    return {
      period: b.period,
      label: b.label,
      minutes: b.minutes,
      hours: Number((b.minutes / 60).toFixed(2)),
      kwh: periodKwh,
      bercPoishaPerKwh: b.poishaPerKwh,
      overheadPoishaPerKwh,
      multiplier,
      effectivePoishaPerKwh: effectiveRate,
      linePoisha,
    };
  });

  if (!property.hasCharger || estimatedKwh <= 0) energyPoisha = 0;

  /* ---------------------------------------------------- discount, taxes -- */
  const subtotal = basePoisha + energyPoisha;
  const discountPoisha = Math.min(Math.max(promoDiscountPoisha, 0), subtotal);
  const net = subtotal - discountPoisha;

  const vatRate = config?.vatRate ?? PLATFORM.VAT_RATE;
  const vatPoisha = percentOf(net, vatRate);
  const processingFeePoisha = percentOf(net, PLATFORM.PROCESSING_FEE_RATE);
  const totalPoisha = net + vatPoisha + processingFeePoisha;

  return {
    rateVersion: rates.version,
    rateSource: rates.source,
    durationMinutes: totalMinutes,
    estimatedKwh: property.hasCharger ? estimatedKwh : 0,
    chargerKw,
    periods: property.hasCharger ? periodLines : [],
    basePoisha,
    energyPoisha,
    discountPoisha,
    subtotalPoisha: subtotal,
    vatRate,
    vatPoisha,
    processingFeeRate: PLATFORM.PROCESSING_FEE_RATE,
    processingFeePoisha,
    totalPoisha,
  };
}

/* ------------------------------------------------------------------------ */
/* Public operations                                                        */
/* ------------------------------------------------------------------------ */

/** Pre-booking estimate. No database writes. */
async function estimate({ propertyId, startAt, endAt, kwh, promoDiscountPoisha }) {
  const property = await Property.findById(propertyId)
    .select('title pricePerHourPoisha hasCharger chargerSpec propertyType')
    .lean();
  if (!property) throw ApiError.notFound('That space no longer exists');

  const [rates, config] = await Promise.all([getActiveRates(), PlatformConfig.current()]);
  const breakdown = calculate({ property, startAt, endAt, kwh, promoDiscountPoisha, rates, config });

  return { property: { _id: property._id, title: property.title, hasCharger: property.hasCharger }, ...breakdown };
}

/**
 * Writes the final price onto the booking.
 *
 * Only `booking.pricing` is touched — the field this feature owns. Escrow
 * reads it and charges exactly this total, so pricing must be settled before
 * payment. Refuses to reprice once funds are held, because an invoice that
 * disagrees with what was charged is worse than no invoice.
 */
async function priceBooking({ bookingId, actorId, role, kwh }) {
  if (!mongoose.isValidObjectId(bookingId)) throw ApiError.badRequest('That is not a valid booking id');

  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('That booking no longer exists');

  const isParty =
    String(booking.driverId) === String(actorId) || String(booking.hostId) === String(actorId);
  if (!isParty && role !== 'ADMIN') throw ApiError.forbidden('You are not a party to this booking');

  if (booking.escrow?.status === 'HELD' || booking.escrow?.status === 'RELEASED') {
    throw ApiError.conflict('This booking is already paid — its price cannot change');
  }

  const property = await Property.findById(booking.propertyId)
    .select('title pricePerHourPoisha hasCharger chargerSpec')
    .lean();
  if (!property) throw ApiError.notFound('That space no longer exists');

  // If [MI]'s IoT session has recorded energy, bill the measured figure.
  let measuredKwh = kwh;
  if (measuredKwh === undefined) {
    const session = await Session.findOne({ bookingId: booking._id }).select('totalKwh').lean();
    if (session?.totalKwh > 0) measuredKwh = session.totalKwh;
  }

  const [rates, config] = await Promise.all([getActiveRates(), PlatformConfig.current()]);
  const breakdown = calculate({
    property,
    startAt: booking.startAt,
    endAt: booking.endAt,
    kwh: measuredKwh,
    promoDiscountPoisha: booking.promo?.discountPoisha || 0,
    rates,
    config,
  });

  booking.pricing = {
    basePoisha: breakdown.basePoisha,
    energyPoisha: breakdown.energyPoisha,
    discountPoisha: breakdown.discountPoisha,
    vatPoisha: breakdown.vatPoisha,
    processingFeePoisha: breakdown.processingFeePoisha,
    totalPoisha: breakdown.totalPoisha,
    estimatedKwh: breakdown.estimatedKwh,
  };
  await booking.save();

  logger.info(`[tariff] priced booking ${booking._id} at ${breakdown.totalPoisha} poisha (${breakdown.rateVersion})`);
  return { bookingId: booking._id, pricing: booking.pricing, breakdown };
}

/**
 * Post-session settlement of the energy portion against measured kWh.
 * Writes the cost back onto the Session document's [GG]-owned fields.
 */
async function finalizeSession(bookingId) {
  const booking = await Booking.findById(bookingId).lean();
  if (!booking) throw ApiError.notFound('That booking no longer exists');

  const session = await Session.findOne({ bookingId });
  if (!session) throw ApiError.notFound('No charging session was recorded for this booking');

  const property = await Property.findById(booking.propertyId)
    .select('pricePerHourPoisha hasCharger chargerSpec')
    .lean();

  const [rates, config] = await Promise.all([getActiveRates(), PlatformConfig.current()]);
  const startAt = session.startedAt || booking.startAt;
  const endAt = session.endedAt || booking.endAt;

  const breakdown = calculate({
    property,
    startAt,
    endAt,
    kwh: session.totalKwh,
    rates,
    config,
  });

  const kwhByPeriod = {
    [TARIFF_PERIOD.OFF_PEAK]: 0,
    [TARIFF_PERIOD.STANDARD]: 0,
    [TARIFF_PERIOD.PEAK]: 0,
  };
  breakdown.periods.forEach((p) => {
    kwhByPeriod[p.period] = Number((kwhByPeriod[p.period] + p.kwh).toFixed(3));
  });

  session.kwhByPeriod = kwhByPeriod;
  session.energyCostPoisha = breakdown.energyPoisha;
  session.tariffBreakdown = { rateVersion: breakdown.rateVersion, periods: breakdown.periods };
  await session.save();

  return { bookingId, sessionId: session._id, energyCostPoisha: breakdown.energyPoisha, kwhByPeriod, breakdown };
}

/* ------------------------------------------------------------------------ */
/* Admin                                                                    */
/* ------------------------------------------------------------------------ */

async function listRateSets() {
  const [sets, active, config] = await Promise.all([
    BercRate.find().sort({ createdAt: -1 }).limit(20).lean(),
    getActiveRates(),
    PlatformConfig.current(),
  ]);
  return { sets, active, tariffMultiplier: config.tariffMultiplier, vatRate: config.vatRate };
}

/** Publishes a new rate set and makes it active. Old versions are kept. */
async function publishRateSet({ version, slabs, note, adminId }) {
  const dbSession = await mongoose.startSession();
  let saved;
  try {
    await dbSession.withTransaction(async () => {
      await BercRate.updateMany({ isActive: true }, { $set: { isActive: false } }, { session: dbSession });
      const [doc] = await BercRate.create(
        [{ version, slabs, note, isActive: true, effectiveFrom: new Date(), updatedBy: adminId }],
        { session: dbSession }
      );
      saved = doc;
    });
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('A rate set with that version already exists');
    throw err;
  } finally {
    await dbSession.endSession();
  }
  return saved;
}

/** Admin dial applied on top of every BERC rate. */
async function setMultiplier({ multiplier, adminId }) {
  const value = Number(multiplier);
  if (!Number.isFinite(value) || value < 0.1 || value > 5) {
    throw ApiError.badRequest('Multiplier must be between 0.1 and 5', undefined, {
      tariffMultiplier: 'Use a value between 0.1 and 5',
    });
  }
  const config = await PlatformConfig.current();
  config.tariffMultiplier = value;
  config.updatedBy = adminId;
  await config.save();
  return { tariffMultiplier: config.tariffMultiplier };
}

module.exports = {
  getActiveRates,
  splitByPeriod,
  calculate,
  estimate,
  priceBooking,
  finalizeSession,
  listRateSets,
  publishRateSet,
  setMultiplier,
};
