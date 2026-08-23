/**
 * MALL HOURS API — OWNER: Tamal Deb Nath [TDN]
 */
import api from '@/lib/api';

export const checkWindow = (payload) => api.post('/mall-hours/check', payload);
export const getPropertyHours = (propertyId) => api.get(`/mall-hours/property/${propertyId}`);
export const getMyProperties = () => api.get('/mall-hours/my-properties');
export const updateHours = (propertyId, payload) => api.patch(`/mall-hours/property/${propertyId}`, payload);
export const runSweep = () => api.post('/mall-hours/sweep', {});
