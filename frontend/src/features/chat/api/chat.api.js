/**
 * CHAT API — OWNER: Maidul Islam [MI]
 */
import api from '@/lib/api';

export const listThreads = () => api.get('/chat/threads');
export const getUnread = () => api.get('/chat/unread');
export const ensureThread = (bookingId) => api.post(`/chat/threads/ensure/${bookingId}`, {});
export const getMessages = (threadId, params = {}) =>
  api.get(`/chat/threads/${threadId}/messages`, { params });
/** REST fallback used when the socket is down. */
export const sendMessage = (threadId, body) =>
  api.post(`/chat/threads/${threadId}/messages`, { body });
export const markRead = (threadId) => api.post(`/chat/threads/${threadId}/read`, {});
