/**
 * ============================================================================
 * ParkShare & Charge — SHARED CONTRACTS
 * ============================================================================
 * 🔒 DO NOT EDIT AFTER INITIAL SETUP — owned by repo initializer only.
 *
 * Every enum, constant and cross-feature contract lives here. All four members
 * import from this file so nobody hardcodes a status string or a commission
 * rate. Changing anything here = `chore/contract/*` PR with 2 approvals.
 *
 * ⚠️ MIRROR FILE: frontend/src/lib/constants.js must be kept identical.
 *    If you change one, change both in the SAME commit.
 * ============================================================================
 */

/* ---------------------------------------------------------------- ROLES --- */
const ROLES = Object.freeze({
  DRIVER: 'DRIVER',
  HOST: 'HOST',
  ADMIN: 'ADMIN',
  IOT_DEVICE: 'IOT_DEVICE',
});

const ACCOUNT_STATE = Object.freeze({
  ACTIVE: 'ACTIVE',
  LOCKED_PENALTY: 'LOCKED_PENALTY',
  SUSPENDED: 'SUSPENDED',
});

/* ------------------------------------------------------------- PROPERTY --- */
const PROPERTY_TYPE = Object.freeze({
  RESIDENTIAL: 'RESIDENTIAL',
  MALL: 'MALL',
});

const VERIFICATION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

/* -------------------------------------------------------------- BOOKING --- */
const BOOKING_STATUS = Object.freeze({
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  CONFIRMED: 'CONFIRMED',
  EN_ROUTE: 'EN_ROUTE',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  OVERSTAY: 'OVERSTAY',
  DISPUTED: 'DISPUTED',
});

/**
 * Statuses that occupy the slot. A booking with one of these blocks any other
 * booking on the same property/time window (enforced by a partial unique index
 * on Booking). Owned by [GG] calendar/slot-locking.
 */
const BLOCKING_STATUSES = Object.freeze([
  BOOKING_STATUS.PENDING_PAYMENT,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.EN_ROUTE,
  BOOKING_STATUS.ACTIVE,
  BOOKING_STATUS.OVERSTAY,
]);

/**
 * Legal state transitions + the ONE service allowed to perform each.
 * If your feature is not listed as the writer, you may READ status but never
 * write it. See Phase 1 plan §4.5.
 */
const BOOKING_TRANSITIONS = Object.freeze({
  [BOOKING_STATUS.PENDING_PAYMENT]: {
    to: [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.EXPIRED, BOOKING_STATUS.CANCELLED],
    writers: ['escrow (TDN)', 'calendar-sweeper (GG)'],
  },
  [BOOKING_STATUS.CONFIRMED]: {
    to: [BOOKING_STATUS.EN_ROUTE, BOOKING_STATUS.ACTIVE, BOOKING_STATUS.CANCELLED],
    writers: ['navigation (MI)', 'geofence (SMR)', 'escrow-refund (TDN)'],
  },
  [BOOKING_STATUS.EN_ROUTE]: {
    to: [BOOKING_STATUS.ACTIVE, BOOKING_STATUS.CANCELLED],
    writers: ['geofence (SMR)', 'escrow-refund (TDN)'],
  },
  [BOOKING_STATUS.ACTIVE]: {
    to: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.OVERSTAY, BOOKING_STATUS.DISPUTED],
    writers: ['penalty (SMR)'],
  },
  [BOOKING_STATUS.OVERSTAY]: {
    to: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.DISPUTED],
    writers: ['penalty (SMR)'],
  },
  [BOOKING_STATUS.COMPLETED]: { to: [BOOKING_STATUS.DISPUTED], writers: ['escrow-refund (TDN)'] },
  [BOOKING_STATUS.CANCELLED]: { to: [], writers: [] },
  [BOOKING_STATUS.EXPIRED]: { to: [], writers: [] },
  [BOOKING_STATUS.DISPUTED]: {
    to: [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED],
    writers: ['escrow-refund (TDN)'],
  },
});

/** Guard helper — use this instead of comparing strings by hand. */
function canTransition(from, to) {
  const rule = BOOKING_TRANSITIONS[from];
  return Boolean(rule && rule.to.includes(to));
}

/* --------------------------------------------------------------- MONEY --- */
const ESCROW_STATUS = Object.freeze({
  NONE: 'NONE',
  HELD: 'HELD',
  RELEASED: 'RELEASED',
  REFUNDED: 'REFUNDED',
  PARTIAL_REFUND: 'PARTIAL_REFUND',
  FAILED: 'FAILED',
});

const LEDGER_TYPE = Object.freeze({
  TOPUP: 'TOPUP',
  ESCROW_HOLD: 'ESCROW_HOLD',
  ESCROW_RELEASE: 'ESCROW_RELEASE',
  HOST_CREDIT: 'HOST_CREDIT',
  PLATFORM_COMMISSION: 'PLATFORM_COMMISSION',
  PENALTY_DEBIT: 'PENALTY_DEBIT',
  REFUND: 'REFUND',
  PAYOUT: 'PAYOUT',
});

const PAYMENT_METHOD = Object.freeze({
  WALLET: 'WALLET',
  SSLCZ_SANDBOX: 'SSLCZ_SANDBOX',
  BKASH_SANDBOX: 'BKASH_SANDBOX',
  MOCK: 'MOCK',
});

const PENALTY_STATUS = Object.freeze({
  ACCRUING: 'ACCRUING',
  SETTLED: 'SETTLED',
  WAIVED: 'WAIVED',
});

/* ------------------------------------------------------------- CHARGING --- */
const SESSION_STATUS = Object.freeze({
  IDLE: 'IDLE',
  CHARGING: 'CHARGING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  FAULT: 'FAULT',
});

const TARIFF_PERIOD = Object.freeze({
  OFF_PEAK: 'OFF_PEAK',
  STANDARD: 'STANDARD',
  PEAK: 'PEAK',
});

const CONNECTOR_TYPE = Object.freeze({
  TYPE_2: 'TYPE_2',
  CCS2: 'CCS2',
  CHADEMO: 'CHADEMO',
  GBT: 'GBT',
  DOMESTIC_3PIN: 'DOMESTIC_3PIN',
});

/* -------------------------------------------------------- NOTIFICATIONS --- */
const NOTIFICATION_TYPE = Object.freeze({
  BOOKING: 'BOOKING',
  PAYMENT: 'PAYMENT',
  CHAT: 'CHAT',
  PENALTY: 'PENALTY',
  VERIFICATION: 'VERIFICATION',
  SYSTEM: 'SYSTEM',
});

/* ----------------------------------------------------- PLATFORM NUMBERS --- */
/**
 * 💰 MONEY RULE: every monetary value in this system is an INTEGER in POISHA.
 *    ৳120.50 is stored as 12050. No floats, ever. Convert only at render time
 *    using utils/money.js (backend) or lib/formatters.js (frontend).
 */
const PLATFORM = Object.freeze({
  COMMISSION_RATE: 0.12,          // 12% platform cut  [SMR payout]
  VAT_RATE: 0.15,                 // 15% VAT           [GG invoice]
  PROCESSING_FEE_RATE: 0.018,     // 1.8% processing   [GG invoice / TDN escrow]

  GEOFENCE_RADIUS_M: 15,          // [SMR geofence]
  SEARCH_RADIUS_MIN_KM: 1,        // [TDN geo-search]
  SEARCH_RADIUS_MAX_KM: 5,
  SEARCH_MAX_RESULTS: 50,

  MIN_BOOKING_MINUTES: 30,        // [GG calendar]
  MAX_BOOKING_HOURS: 12,
  SLOT_LOCK_TTL_SECONDS: 600,     // unpaid booking expires after 10 min

  CHECKOUT_GRACE_MINUTES: 15,     // [SMR penalty]
  PENALTY_RATE_POISHA_PER_MIN: 500,   // ৳5 / minute
  PENALTY_MAX_POISHA: 200000,         // ৳2000 cap

  IOT_TICK_MS: 3000,              // [MI iot-grid]
  PROMO_MAX_DISCOUNT_POISHA: 50000,   // ৳500 cap  [MI promo]

  CURRENCY: 'BDT',
  TIMEZONE: 'Asia/Dhaka',
  DHAKA_CENTER: { lat: 23.8103, lng: 90.4125 },
});

/**
 * BERC electricity slabs — seed values for [GG] tariff calculator.
 * Windows are in Asia/Dhaka local hours (24h). Rates in poisha per kWh.
 */
const BERC_SLABS = Object.freeze([
  { period: TARIFF_PERIOD.OFF_PEAK, startHour: 0, endHour: 8, poishaPerKwh: 620 },
  { period: TARIFF_PERIOD.STANDARD, startHour: 8, endHour: 17, poishaPerKwh: 850 },
  { period: TARIFF_PERIOD.PEAK, startHour: 17, endHour: 23, poishaPerKwh: 1240 },
  { period: TARIFF_PERIOD.STANDARD, startHour: 23, endHour: 24, poishaPerKwh: 850 },
]);

/* --------------------------------------------------------- SOCKET EVENTS -- */
const SOCKET_NAMESPACES = Object.freeze({ IOT: '/iot', CHAT: '/chat' });

const SOCKET_EVENTS = Object.freeze({
  IOT_SUBSCRIBE: 'iot:subscribe',
  IOT_READING: 'iot:reading',
  IOT_SHUTDOWN: 'iot:shutdown',
  IOT_FAULT: 'iot:fault',
  CHAT_JOIN: 'chat:join',
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',
  CHAT_READ: 'chat:read',
  BOOKING_STATUS_CHANGED: 'booking:status_changed',
  NOTIFICATION_PUSH: 'notification:push',
});

/* ----------------------------------------------------------- ERROR CODES -- */
const ERROR_CODES = Object.freeze({
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  PHONE_TAKEN: 'PHONE_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  ACCOUNT_LOCKED_PENALTY: 'ACCOUNT_LOCKED_PENALTY',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  SLOT_ALREADY_BOOKED: 'SLOT_ALREADY_BOOKED',
  OUTSIDE_MALL_HOURS: 'OUTSIDE_MALL_HOURS',
  INSUFFICIENT_WALLET_BALANCE: 'INSUFFICIENT_WALLET_BALANCE',
  PROMO_INVALID: 'PROMO_INVALID',
  PROMO_EXPIRED: 'PROMO_EXPIRED',
  NOT_IN_GEOFENCE: 'NOT_IN_GEOFENCE',
  HOST_NOT_VERIFIED: 'HOST_NOT_VERIFIED',
  BOOKING_STATE_INVALID: 'BOOKING_STATE_INVALID',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  INTERNAL: 'INTERNAL',
});

/* ------------------------------------------------- BOOKING STATUS THEME --- */
/**
 * Maps a booking status to a DESIGN TOKEN NAME (never a hex value).
 * Consumed by the shared <StatusBadge /> so all four members render an
 * identical chip. See design system doc §7.5.
 */
const BOOKING_STATUS_THEME = Object.freeze({
  [BOOKING_STATUS.PENDING_PAYMENT]: { token: 'warning', label: 'Awaiting payment', pulse: false },
  [BOOKING_STATUS.CONFIRMED]: { token: 'info', label: 'Confirmed', pulse: false },
  [BOOKING_STATUS.EN_ROUTE]: { token: 'accent', label: 'On the way', pulse: false },
  [BOOKING_STATUS.ACTIVE]: { token: 'primary', label: 'Active', pulse: true },
  [BOOKING_STATUS.COMPLETED]: { token: 'success-subtle', label: 'Completed', pulse: false },
  [BOOKING_STATUS.CANCELLED]: { token: 'muted', label: 'Cancelled', pulse: false },
  [BOOKING_STATUS.EXPIRED]: { token: 'muted', label: 'Expired', pulse: false },
  [BOOKING_STATUS.OVERSTAY]: { token: 'danger', label: 'Overstay', pulse: false },
  [BOOKING_STATUS.DISPUTED]: { token: 'danger-outline', label: 'Under review', pulse: false },
});

/**
 * Raw hex values — BACKEND / PDF USE ONLY (PDFKit invoices need literals).
 * Frontend code must NEVER import these; use Tailwind token classes instead.
 */
const THEME_HEX = Object.freeze({
  brandPrimary: '#10B981',
  brandPrimaryHover: '#059669',
  brandPrimarySubtle: '#ECFDF5',
  brandSecondary: '#0F172A',
  brandSecondarySoft: '#1E293B',
  brandAccent: '#7C3AED',
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#0284C7',
  ink: '#0F172A',
  inkMuted: '#64748B',
  line: '#E2E8F0',
  surface: '#FFFFFF',
  surfaceSunken: '#F8FAFC',
});

module.exports = {
  ROLES,
  ACCOUNT_STATE,
  PROPERTY_TYPE,
  VERIFICATION_STATUS,
  BOOKING_STATUS,
  BLOCKING_STATUSES,
  BOOKING_TRANSITIONS,
  canTransition,
  ESCROW_STATUS,
  LEDGER_TYPE,
  PAYMENT_METHOD,
  PENALTY_STATUS,
  SESSION_STATUS,
  TARIFF_PERIOD,
  CONNECTOR_TYPE,
  NOTIFICATION_TYPE,
  PLATFORM,
  BERC_SLABS,
  SOCKET_NAMESPACES,
  SOCKET_EVENTS,
  ERROR_CODES,
  BOOKING_STATUS_THEME,
  THEME_HEX,
};
