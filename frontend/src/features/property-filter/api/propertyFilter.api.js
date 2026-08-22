/**
 * PROPERTY FILTER API — OWNER: Tamal Deb Nath [TDN]
 */
import api from '@/lib/api';

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

export const listProperties = (params) => api.get('/filter/properties', { params: clean(params) });
export const getCategoryCounts = (params) => api.get('/filter/counts', { params: clean(params) });
export const getFilterOptions = () => api.get('/filter/options');
