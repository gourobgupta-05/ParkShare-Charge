/**
 * PROMO API — OWNER: Maidul Islam [MI]
 */
import api from '@/lib/api';

export const validateCode = (code, bookingId) => api.post('/promo/validate', { code, bookingId });
export const applyCode = (code, bookingId) => api.post('/promo/apply', { code, bookingId });
export const removeCode = (bookingId) => api.delete(`/promo/booking/${bookingId}`);
export const listActive = (propertyType) =>
  api.get('/promo/active', { params: propertyType ? { propertyType } : {} });

export const listAllCodes = (params = {}) => api.get('/promo/admin/codes', { params });
export const createCode = (payload) => api.post('/promo/admin/codes', payload);
export const updateCode = (id, payload) => api.patch(`/promo/admin/codes/${id}`, payload);
