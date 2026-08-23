/**
 * REVIEW API — OWNER: Gourob Gupta [GG]
 */
import api from '@/lib/api';

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const getTags = () => api.get('/reviews/tags');
export const listForProperty = (propertyId, params = {}) =>
  api.get(`/reviews/property/${propertyId}`, { params: clean(params) });
export const listForHost = (hostId, params = {}) =>
  api.get(`/reviews/host/${hostId}`, { params: clean(params) });
export const listPending = () => api.get('/reviews/pending');
export const getByBooking = (bookingId) => api.get(`/reviews/booking/${bookingId}`);
export const createReview = (payload) => api.post('/reviews', payload);
export const editReview = (id, payload) => api.patch(`/reviews/${id}`, payload);
export const replyToReview = (id, body) => api.post(`/reviews/${id}/reply`, { body });
