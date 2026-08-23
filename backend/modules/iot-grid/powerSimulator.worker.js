/**
 * ============================================================================
 * SIMULATED POWER GRID BROKER — OWNER: Maidul Islam [MI]
 * ============================================================================
 * Stands in for a real OCPP charge point. One ticker per active session emits
 * voltage/current/kW over the /iot socket namespace and folds the energy into
 * the shared Session document.
 *
 * MODELLING CHOICES THAT MATTER
 *  - Seeded PRNG (mulberry32), so a demo replays identically. Set IOT_SIM_SEED.
 *  - Voltage random-walks around 220 V with mild sag under load, which is what
 *    a Dhaka feeder actually does, rather than sitting at a flat 220.
 *  - Power ramps up over ~30 s and tapers above 80% state of charge, mirroring
 *    a real CC/CV charging curve instead of a square wave.
 *  - Readings are emitted every tick but persisted every Nth tick, because
 *    writing 1 document per 3 s per session would dominate the free Atlas tier.
 * ============================================================================
 */
const { Session, Booking, Property } = require('../../models');
const PowerReading = require('./powerReading.model');
const logger = require('../../utils/logger');
const { SESSION_STATUS, SOCKET_EVENTS } = require('../../shared/constants');

const TICK_MS = Math.max(Number(process.env.IOT_TICK_INTERVAL_MS) || 3000, 500);
const NOMINAL_VOLTAGE = Number(process.env.IOT_VOLTAGE_NOMINAL) || 220;
const MAX_KW_FALLBACK = Number(process.env.IOT_MAX_KW) || 22;
const FAULT_PROBABILITY = Number(process.env.IOT_FAULT_PROBABILITY) || 0.01;
const RETENTION_HOURS = Number(process.env.IOT_READING_RETENTION_HOURS) || 48;
const PERSIST_EVERY = Math.max(Number(process.env.IOT_PERSIST_EVERY_TICKS) || 5, 1);
const BASE_SEED = Number(process.env.IOT_SIM_SEED) || 471;

/** Deterministic PRNG — same seed, same demo, every time. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** sessionId -> ticker state */
const tickers = new Map();

/** Set by gridBroker.socket.js once the namespace is registered. */
let namespace = null;
function bindNamespace(nsp) {
  namespace = nsp;
}

function emit(event, sessionId, payload) {
  if (!namespace) return;
  namespace.to(`session:${sessionId}`).emit(event, payload);
}

const FAULT_CODES = ['OVER_TEMPERATURE', 'CONNECTOR_LOCK_FAILURE', 'GROUND_FAULT', 'VOLTAGE_SAG'];

/** Produces one reading and advances the ticker's internal state. */
function nextReading(state) {
  const rand = state.rand;
  state.tick += 1;

  const elapsedSeconds = (state.tick * TICK_MS) / 1000;

  // Ramp to full power over 30 s.
  const ramp = Math.min(elapsedSeconds / 30, 1);
  // Taper once the notional battery passes 80%.
  const soc = Math.min(state.cumulativeKwh / Math.max(state.batteryKwh, 1), 1);
  const taper = soc > 0.8 ? Math.max(1 - (soc - 0.8) / 0.2, 0.12) : 1;

  const jitter = 0.94 + rand() * 0.12;
  let kw = state.maxKw * ramp * taper * jitter;
  if (soc >= 0.999) kw = 0;

  // Voltage walks around nominal and sags in proportion to draw.
  state.voltage += (rand() - 0.5) * 1.6;
  state.voltage = Math.min(Math.max(state.voltage, NOMINAL_VOLTAGE - 12), NOMINAL_VOLTAGE + 8);
  const sag = (kw / Math.max(state.maxKw, 1)) * 4;
  const voltage = Number((state.voltage - sag).toFixed(1));

  const current = voltage > 0 ? Number(((kw * 1000) / voltage).toFixed(2)) : 0;

  state.cumulativeKwh += (kw * TICK_MS) / 3600000;
  state.peakKw = Math.max(state.peakKw, kw);
  state.voltageSum += voltage;

  let faultCode = null;
  if (rand() < FAULT_PROBABILITY) {
    faultCode = FAULT_CODES[Math.floor(rand() * FAULT_CODES.length)];
    state.faults += 1;
  }

  return {
    sessionId: state.sessionId,
    bookingId: state.bookingId,
    ts: new Date(),
    voltage,
    current,
    kw: Number(kw.toFixed(3)),
    cumulativeKwh: Number(state.cumulativeKwh.toFixed(4)),
    temperatureC: Number((28 + soc * 12 + rand() * 2).toFixed(1)),
    faultCode,
    socPercent: Number((soc * 100).toFixed(1)),
    isSimulated: true,
  };
}

/** Writes the running totals back to the shared Session document. */
async function persist(state, reading) {
  try {
    await PowerReading.create({
      sessionId: state.sessionId,
      bookingId: state.bookingId,
      ts: reading.ts,
      voltage: reading.voltage,
      current: reading.current,
      kw: reading.kw,
      cumulativeKwh: reading.cumulativeKwh,
      temperatureC: reading.temperatureC,
      faultCode: reading.faultCode,
      expiresAt: new Date(Date.now() + RETENTION_HOURS * 3600000),
    });

    await Session.updateOne(
      { _id: state.sessionId },
      {
        $set: {
          totalKwh: Number(state.cumulativeKwh.toFixed(4)),
          peakKw: Number(state.peakKw.toFixed(3)),
          avgVoltage: Number((state.voltageSum / Math.max(state.tick, 1)).toFixed(1)),
          lastReadingAt: reading.ts,
          ...(reading.faultCode ? { faultCode: reading.faultCode } : {}),
        },
      }
    );
  } catch (err) {
    logger.warn(`[iot] could not persist reading for session ${state.sessionId}: ${err.message}`);
  }
}

async function tick(sessionId) {
  const state = tickers.get(String(sessionId));
  if (!state) return;

  const reading = nextReading(state);
  emit(SOCKET_EVENTS.IOT_READING, sessionId, reading);

  if (reading.faultCode) {
    emit(SOCKET_EVENTS.IOT_FAULT, sessionId, {
      sessionId,
      faultCode: reading.faultCode,
      at: reading.ts,
    });
  }

  if (state.tick % PERSIST_EVERY === 0) await persist(state, reading);

  // Stop on a full charge so the ticker does not run forever.
  if (reading.socPercent >= 99.9) {
    logger.info(`[iot] session ${sessionId} reached full charge, stopping broker`);
    await stop(sessionId, { reason: 'FULL_CHARGE' });
  }
}

/**
 * Starts the broker for a session. Idempotent — a second call is a no-op, so
 * two browser tabs subscribing does not double the energy.
 */
async function start({ sessionId, bookingId, maxKw, batteryKwh }) {
  const key = String(sessionId);
  if (tickers.has(key)) return tickers.get(key);

  const session = await Session.findById(sessionId).select('totalKwh peakKw').lean();

  const state = {
    sessionId: key,
    bookingId: String(bookingId),
    tick: 0,
    rand: mulberry32(BASE_SEED + (key.charCodeAt(key.length - 1) || 0)),
    maxKw: Number(maxKw) > 0 ? Number(maxKw) : MAX_KW_FALLBACK,
    batteryKwh: Number(batteryKwh) > 0 ? Number(batteryKwh) : 45,
    cumulativeKwh: session?.totalKwh || 0, // resume where a restart left off
    peakKw: session?.peakKw || 0,
    voltage: NOMINAL_VOLTAGE,
    voltageSum: 0,
    faults: 0,
    startedAt: new Date(),
  };

  state.handle = setInterval(() => {
    tick(key).catch((err) => logger.error(`[iot] tick failed: ${err.message}`));
  }, TICK_MS);
  if (state.handle.unref) state.handle.unref();

  tickers.set(key, state);
  logger.info(`[iot] broker started for session ${key} at ${state.maxKw} kW`);
  return state;
}

/** Stops the ticker and flushes the final totals. */
async function stop(sessionId, { reason = 'STOPPED', status = SESSION_STATUS.STOPPED } = {}) {
  const key = String(sessionId);
  const state = tickers.get(key);
  if (state) {
    clearInterval(state.handle);
    tickers.delete(key);

    await Session.updateOne(
      { _id: key },
      {
        $set: {
          status,
          endedAt: new Date(),
          totalKwh: Number(state.cumulativeKwh.toFixed(4)),
          peakKw: Number(state.peakKw.toFixed(3)),
          avgVoltage: Number((state.voltageSum / Math.max(state.tick, 1)).toFixed(1)),
        },
      }
    );
  }

  emit(SOCKET_EVENTS.IOT_SHUTDOWN, key, { sessionId: key, reason, status, at: new Date() });
  logger.info(`[iot] broker stopped for session ${key} (${reason})`);
  return { sessionId: key, stopped: true, reason };
}

const isRunning = (sessionId) => tickers.has(String(sessionId));

const activeSessions = () =>
  [...tickers.values()].map((s) => ({
    sessionId: s.sessionId,
    bookingId: s.bookingId,
    ticks: s.tick,
    kwh: Number(s.cumulativeKwh.toFixed(3)),
    maxKw: s.maxKw,
    startedAt: s.startedAt,
  }));

/**
 * Resumes brokers for sessions left CHARGING by a restart. Render's free tier
 * sleeps, so without this a session silently stops metering mid-charge.
 */
async function resumeOnBoot() {
  try {
    const charging = await Session.find({ status: SESSION_STATUS.CHARGING }).limit(20).lean();
    for (const session of charging) {
      const booking = await Booking.findById(session.bookingId).select('propertyId').lean();
      const property = booking
        ? await Property.findById(booking.propertyId).select('chargerSpec').lean()
        : null;
      await start({
        sessionId: session._id,
        bookingId: session.bookingId,
        maxKw: property?.chargerSpec?.kw,
        batteryKwh: null,
      });
    }
    if (charging.length) logger.info(`[iot] resumed ${charging.length} charging session(s) after boot`);
  } catch (err) {
    logger.warn(`[iot] boot resume skipped: ${err.message}`);
  }
}

module.exports = {
  start,
  stop,
  tick,
  isRunning,
  activeSessions,
  bindNamespace,
  resumeOnBoot,
  mulberry32,
  nextReading,
  TICK_MS,
};
