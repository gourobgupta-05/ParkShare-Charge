'use client';
/**
 * DOWNLOAD INVOICE BUTTON — OWNER: Gourob Gupta [GG]
 * Generates the invoice first when one does not exist yet, then downloads it.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { generateInvoice, downloadInvoicePdf } from '../api/invoice.api';

export default function DownloadInvoiceButton({ invoiceId, invoiceNo, bookingId, size = 'md', variant = 'outline' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      let id = invoiceId;
      let no = invoiceNo;

      if (!id && bookingId) {
        const invoice = await generateInvoice(bookingId);
        id = invoice._id;
        no = invoice.invoiceNo;
      }
      if (!id) throw new Error('No invoice is available for this booking yet');

      await downloadInvoicePdf(id, no);
    } catch (err) {
      setError(err.message || 'Could not download the invoice');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={run} isLoading={busy} size={size} variant={variant}>
        Download PDF
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
