/**
 * TARIFF API — OWNER: Gourob Gupta [GG]
 */
import api from '@/lib/api';

export const getRates = () => api.get('/tariff/rates');
export const estimate = (payload) => api.post('/tariff/estimate', payload);
export const priceBooking = (bookingId, payload = {}) => api.post(`/tariff/price/${bookingId}`, payload);
export const finalizeSession = (bookingId) => api.post(`/tariff/finalize/${bookingId}`, {});

export const listRateSets = () => api.get('/tariff/admin/rates');
export const publishRateSet = (payload) => api.post('/tariff/admin/rates', payload);
export const setMultiplier = (tariffMultiplier) =>
  api.patch('/tariff/admin/multiplier', { tariffMultiplier });
