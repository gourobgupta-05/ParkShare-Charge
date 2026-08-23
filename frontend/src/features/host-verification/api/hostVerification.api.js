/**
 * HOST VERIFICATION API — OWNER: S. Moontaha Rahman [SMR]
 */
import api from '@/lib/api';

export const getMine = () => api.get('/host-verification/me');
export const saveDraft = (payload) => api.patch('/host-verification/me', payload);
export const uploadDocument = (kind, file) => api.post('/host-verification/documents', { kind, file });
export const submit = () => api.post('/host-verification/submit', {});

export const listMySpaces = () => api.get('/host-verification/spaces');
export const provisionSpace = (payload) => api.post('/host-verification/spaces', payload);
export const setPublished = (propertyId, isPublished) =>
  api.patch(`/host-verification/spaces/${propertyId}/publish`, { isPublished });

export const adminQueue = (params = {}) => api.get('/host-verification/admin/queue', { params });
export const adminDetail = (id) => api.get(`/host-verification/admin/${id}`);
export const adminApprove = (id, notes) => api.post(`/host-verification/admin/${id}/approve`, { notes });
export const adminReject = (id, reason) => api.post(`/host-verification/admin/${id}/reject`, { reason });

/** Reads a File into the { mimeType, base64 } shape the API expects. */
export function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const base64 = result.split(',')[1];
      resolve({ mimeType: file.type, base64, name: file.name });
    };
    reader.onerror = () => reject(new Error('That file could not be read'));
    reader.readAsDataURL(file);
  });
}
