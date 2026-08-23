/**
 * GEOFENCE API — OWNER: S. Moontaha Rahman [SMR]
 */
import api from '@/lib/api';

export const getTarget = (bookingId) => api.get(`/geofence/target/${bookingId}`);
export const ping = (bookingId, coords) => api.post(`/geofence/ping/${bookingId}`, coords);
export const manualCheckIn = (bookingId, coords = {}) =>
  api.post(`/geofence/checkin/${bookingId}`, coords);
export const issuePass = (bookingId) => api.get(`/geofence/pass/${bookingId}`);
export const verifyPass = (token) => api.post('/geofence/pass/verify', { token });
