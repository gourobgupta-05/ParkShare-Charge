/**
 * ============================================================================
 * 🔒 API CLIENT — DO NOT EDIT AFTER INITIAL SETUP
 * ============================================================================
 * The ONLY way any feature talks to the backend. Handles the base URL, the
 * auth header, automatic token refresh on 401, and unwrapping the standard
 * { success, data, message, code } envelope.
 *
 * In your feature:
 *   import api from '@/lib/api';
 *   const spaces = await api.get('/geo/search', { params: { lat, lng, radiusKm } });
 *   // `spaces` is already the `data` object — no response.data.data
 *
 * Errors arrive as: { message, code, details, status } — show `message` to the
 * user and branch on `code` (see ERROR_CODES).
 * ============================================================================
 */
import axios from 'axios';

const BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '') + '/api';

const ACCESS_KEY = 'psc_access_token';
const REFRESH_KEY = 'psc_refresh_token';

/* ------------------------------------------------------------ token store */
export const tokenStore = {
  get access() {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(REFRESH_KEY);
  },
  set({ accessToken, refreshToken }) {
    if (typeof window === 'undefined') return;
    if (accessToken) window.localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

/* -------------------------------------------------------------- instance */
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/* --------------------------------------------------- refresh-on-401 flow */
let refreshing = null;

async function refreshSession() {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) throw new Error('NO_REFRESH_TOKEN');

  const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
  tokenStore.set(data.data);
  return data.data.accessToken;
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;

    const isAuthRoute = String(original.url || '').includes('/auth/');
    if (status === 401 && !original._retried && !isAuthRoute && tokenStore.refresh) {
      original._retried = true;
      try {
        refreshing = refreshing || refreshSession().finally(() => { refreshing = null; });
        const newToken = await refreshing;
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return client(original);
      } catch {
        tokenStore.clear();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject({
      message: error.response?.data?.message || 'Could not reach the server. Check your connection.',
      code: error.response?.data?.code || 'NETWORK_ERROR',
      details: error.response?.data?.details || null,
      status: status || 0,
    });
  }
);

/** Unwraps the envelope so features never write `res.data.data`. */
const unwrap = (promise) => promise.then((res) => res.data?.data ?? res.data);

const api = {
  get: (url, config) => unwrap(client.get(url, config)),
  post: (url, body, config) => unwrap(client.post(url, body, config)),
  patch: (url, body, config) => unwrap(client.patch(url, body, config)),
  put: (url, body, config) => unwrap(client.put(url, body, config)),
  delete: (url, config) => unwrap(client.delete(url, config)),
  /** Escape hatch when you need headers/status — e.g. PDF downloads [GG]. */
  raw: client,
};

export default api;
