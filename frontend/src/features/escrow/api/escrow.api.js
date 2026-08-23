/**
 * ESCROW API — OWNER: Tamal Deb Nath [TDN]
 */
import api from '@/lib/api';

export const getWallet = () => api.get('/escrow/wallet');
export const initiateTopUp = (amountPoisha) => api.post('/escrow/topup', { amountPoisha });
export const confirmTopUp = (payload) => api.post('/escrow/topup/confirm', payload);
export const tokenizeInstrument = (method) => api.post('/escrow/tokenize', { method });

export const holdFunds = (payload) => api.post('/escrow/hold', payload);
export const getHold = (bookingId) => api.get(`/escrow/booking/${bookingId}`);
export const listMyHolds = () => api.get('/escrow/mine');
export const refundBooking = (bookingId, payload = {}) => api.post(`/escrow/refund/${bookingId}`, payload);
export const openDispute = (bookingId, reason) => api.post(`/escrow/dispute/${bookingId}`, { reason });

export const listHolds = (params) => api.get('/escrow/holds', { params });
