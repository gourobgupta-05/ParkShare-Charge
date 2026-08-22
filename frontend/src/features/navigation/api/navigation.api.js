/**
 * NAVIGATION API — OWNER: Maidul Islam [MI]
 */
import api from '@/lib/api';

export const getProviderStatus = () => api.get('/navigation/provider');
export const getDestination = (bookingId) => api.get(`/navigation/destination/${bookingId}`);
export const startRoute = (bookingId, origin) => api.post(`/navigation/route/${bookingId}`, origin);
export const refreshEta = (bookingId, { lat, lng }) =>
  api.get(`/navigation/eta/${bookingId}`, { params: { lat, lng } });
export const stopRoute = (bookingId) => api.post(`/navigation/stop/${bookingId}`, {});
