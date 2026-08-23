/**
 * PAYOUT API — OWNER: S. Moontaha Rahman [SMR]
 */
import api from '@/lib/api';

export const getEarnings = () => api.get('/payout/earnings');
export const getLedger = (params = {}) => api.get('/payout/ledger', { params });
export const requestWithdrawal = (amountPoisha) => api.post('/payout/withdraw', { amountPoisha });
export const settleBooking = (bookingId) => api.post(`/payout/settle/${bookingId}`, {});

export const getCommission = () => api.get('/payout/admin/commission');
export const setCommission = (commissionRate) =>
  api.patch('/payout/admin/commission', { commissionRate });
export const listBatches = (params = {}) => api.get('/payout/admin/batches', { params });
export const markPaid = (batchId) => api.post(`/payout/admin/batches/${batchId}/paid`, {});
