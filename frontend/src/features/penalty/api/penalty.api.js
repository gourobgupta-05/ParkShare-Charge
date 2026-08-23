/**
 * PENALTY API — OWNER: S. Moontaha Rahman [SMR]
 */
import api from '@/lib/api';

export const checkout = (bookingId) => api.post(`/penalty/checkout/${bookingId}`, {});
export const getStatus = (bookingId) => api.get(`/penalty/status/${bookingId}`);
export const listMine = () => api.get('/penalty/mine');
export const payPenalty = (penaltyId) => api.post(`/penalty/${penaltyId}/pay`, {});

export const listAll = (params = {}) => api.get('/penalty/admin/list', { params });
export const waivePenalty = (penaltyId, reason) => api.post(`/penalty/admin/${penaltyId}/waive`, { reason });
