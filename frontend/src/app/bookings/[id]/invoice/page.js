'use client';
/**
 * INVOICE VIEW — OWNER: Gourob Gupta [GG]
 * Generates the invoice on first visit, then renders it.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import InvoicePreview from '@/features/invoices/components/InvoicePreview';
import { generateInvoice, getInvoice } from '@/features/invoices/api/invoice.api';

function InvoiceScreen() {
  const { id: bookingId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [energyBreakdown, setEnergyBreakdown] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Idempotent: returns the existing invoice if one was already issued.
        const created = await generateInvoice(bookingId);
        const full = await getInvoice(created._id);
        if (cancelled) return;
        setInvoice(full.invoice);
        setEnergyBreakdown(full.energyBreakdown);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [bookingId]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <Link href={`/bookings/${bookingId}`} className="text-caption text-ink-muted underline hover:text-ink">
        ← Back to booking
      </Link>

      {isLoading && <div className="py-12"><Spinner label="Preparing your invoice" /></div>}
      {error && <Alert tone="danger">{error}</Alert>}
      {invoice && <InvoicePreview invoice={invoice} energyBreakdown={energyBreakdown} />}
    </main>
  );
}

export default function InvoicePage() {
  return (
    <ProtectedRoute>
      <InvoiceScreen />
    </ProtectedRoute>
  );
}
