/**
 * IoT API — OWNER: Maidul Islam [MI]
 */
import api from '@/lib/api';

export const getBrokerStatus = () => api.get('/iot/broker-status');
export const startSession = (bookingId) => api.post(`/iot/sessions/${bookingId}/start`, {});
export const getSession = (bookingId) => api.get(`/iot/sessions/${bookingId}`);
export const getReadings = (bookingId, limit = 120) =>
  api.get(`/iot/sessions/${bookingId}/readings`, { params: { limit } });
export const pauseSession = (sessionId) => api.post(`/iot/sessions/${sessionId}/pause`, {});
export const stopSession = (sessionId, reason) =>
  api.post(`/iot/sessions/${sessionId}/stop`, { reason });
export const getHostEnergyLogs = (params = {}) => api.get('/iot/host/energy-logs', { params });
