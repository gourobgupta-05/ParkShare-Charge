/**
 * INVOICE API — OWNER: Gourob Gupta [GG]
 */
import api from '@/lib/api';

export const listInvoices = (params = {}) => api.get('/invoices', { params });
export const getInvoice = (id) => api.get(`/invoices/${id}`);
export const generateInvoice = (bookingId) => api.post(`/invoices/generate/${bookingId}`, {});

/**
 * PDFs need the raw axios instance: the shared client unwraps the JSON
 * envelope, which would corrupt a binary body.
 */
export async function downloadInvoicePdf(invoiceId, invoiceNo = 'invoice') {
  const response = await api.raw.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));

  const link = document.createElement('a');
  link.href = url;
  link.download = `${invoiceNo}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
