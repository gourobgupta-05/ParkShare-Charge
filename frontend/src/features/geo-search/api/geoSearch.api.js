/**
 * GEO SEARCH API — OWNER: Tamal Deb Nath [TDN]
 * Thin wrappers over the shared axios client. No other feature imports these.
 */
import api from '@/lib/api';

/** Strips undefined/null so the query string stays clean. */
const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const searchNearby = (params) => api.get('/geo/search', { params: clean(params) });

export const searchViewport = (bounds) => api.get('/geo/viewport', { params: clean(bounds) });

export const getPropertyDetail = (id, coords = {}) =>
  api.get(`/geo/properties/${id}`, { params: clean(coords) });

export const getGeoIndexHealth = () => api.get('/geo/index-health');
