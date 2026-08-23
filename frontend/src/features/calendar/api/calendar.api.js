/**
 * CALENDAR API — OWNER: Gourob Gupta [GG]
 */
import api from '@/lib/api';

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const getDayAvailability = (propertyId, date) =>
  api.get(`/calendar/availability/${propertyId}`, { params: { date } });

export const getRangeAvailability = (propertyId, from, to) =>
  api.get(`/calendar/availability/${propertyId}/range`, { params: { from, to } });

export const createBooking = (payload) => api.post('/calendar/bookings', payload);
export const listBookings = (params = {}) => api.get('/calendar/bookings', { params: clean(params) });
export const getBooking = (id) => api.get(`/calendar/bookings/${id}`);
export const cancelBooking = (id) => api.post(`/calendar/bookings/${id}/cancel`, {});

export const getMyCalendars = () => api.get('/calendar/my-calendars');
export const setAvailability = (propertyId, payload) =>
  api.put(`/calendar/availability/${propertyId}`, payload);
