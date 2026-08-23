/**
 * 🔒 FRONTEND MIRROR of backend/shared/constants.js — DO NOT EDIT ALONE.
 * If you change one, change BOTH in the same commit. The PR checklist asks.
 * Only the subset the UI actually needs is mirrored here.
 */
export const ROLES = Object.freeze({
  DRIVER: 'DRIVER',
  HOST: 'HOST',
  ADMIN: 'ADMIN',
  IOT_DEVICE: 'IOT_DEVICE',
});

export const PROPERTY_TYPE = Object.freeze({ RESIDENTIAL: 'RESIDENTIAL', MALL: 'MALL' });

export const VERIFICATION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const BOOKING_STATUS = Object.freeze({
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

export const SESSION_STATUS = Object.freeze({
  IDLE: 'IDLE', CHARGING: 'CHARGING', PAUSED: 'PAUSED', STOPPED: 'STOPPED', FAULT: 'FAULT',
});

export const TARIFF_PERIOD = Object.freeze({ OFF_PEAK: 'OFF_PEAK', STANDARD: 'STANDARD', PEAK: 'PEAK' });

export const CONNECTOR_TYPE = Object.freeze({
  TYPE_2: 'TYPE_2', CCS2: 'CCS2', CHADEMO: 'CHADEMO', GBT: 'GBT', DOMESTIC_3PIN: 'DOMESTIC_3PIN',
});

export const PLATFORM = Object.freeze({
  COMMISSION_RATE: 0.12,
  VAT_RATE: 0.15,
  GEOFENCE_RADIUS_M: 15,
  SEARCH_RADIUS_MIN_KM: 1,
  SEARCH_RADIUS_MAX_KM: 5,
  MIN_BOOKING_MINUTES: 30,
  MAX_BOOKING_HOURS: 12,
  CHECKOUT_GRACE_MINUTES: 15,
  CURRENCY: 'BDT',
  TIMEZONE: 'Asia/Dhaka',
  DHAKA_CENTER: { lat: 23.8103, lng: 90.4125 },
});

export const SOCKET_NAMESPACES = Object.freeze({ IOT: '/iot', CHAT: '/chat' });

export const SOCKET_EVENTS = Object.freeze({
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

export const ERROR_CODES = Object.freeze({
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  PHONE_TAKEN: 'PHONE_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SLOT_ALREADY_BOOKED: 'SLOT_ALREADY_BOOKED',
  OUTSIDE_MALL_HOURS: 'OUTSIDE_MALL_HOURS',
  INSUFFICIENT_WALLET_BALANCE: 'INSUFFICIENT_WALLET_BALANCE',
  PROMO_INVALID: 'PROMO_INVALID',
  NOT_IN_GEOFENCE: 'NOT_IN_GEOFENCE',
  HOST_NOT_VERIFIED: 'HOST_NOT_VERIFIED',
  ACCOUNT_LOCKED_PENALTY: 'ACCOUNT_LOCKED_PENALTY',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
});

/**
 * Booking status → TOKEN NAME (never a hex). Drives <StatusBadge />.
 * Keeps everyone's "Active" chip identical.
 */
export const BOOKING_STATUS_THEME = Object.freeze({
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
