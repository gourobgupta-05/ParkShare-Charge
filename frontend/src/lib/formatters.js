/**
 * 🔒 Shared formatters. Money is ALWAYS an integer in poisha coming from the
 * API — never format it yourself with toFixed().
 */
import { PLATFORM } from './constants';

export const poishaToTaka = (poisha) => Number(poisha || 0) / 100;

export const formatMoney = (poisha, { withSymbol = true } = {}) => {
  const value = poishaToTaka(poisha).toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `৳${value}` : value;
};

export const formatKwh = (kwh) => `${Number(kwh || 0).toFixed(2)} kWh`;
export const formatKw = (kw) => `${Number(kw || 0).toFixed(1)} kW`;

const dhaka = { timeZone: PLATFORM.TIMEZONE };

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('en-GB', { ...dhaka, dateStyle: 'medium', timeStyle: 'short' });

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', { ...dhaka, hour: '2-digit', minute: '2-digit' });

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { ...dhaka, dateStyle: 'medium' });

export const formatDistance = (metres) =>
  metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;

export const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
};

/** Tiny classname joiner so nobody installs a different one. */
export const cn = (...parts) => parts.filter(Boolean).join(' ');
