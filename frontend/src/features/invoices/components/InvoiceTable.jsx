'use client';
/**
 * INVOICE TABLE — OWNER: Gourob Gupta [GG]
 */
import Link from 'next/link';
import Money from '@/components/ui/Money';
import EmptyState from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/formatters';
import DownloadInvoiceButton from './DownloadInvoiceButton';

export default function InvoiceTable({ invoices = [], totals }) {
  if (!invoices.length) {
    return (
      <EmptyState
        title="No invoices yet"
        description="An invoice is issued automatically once a session completes."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {totals && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Total billed', poisha: totals.totalPoisha },
            { label: 'VAT collected', poisha: totals.vatPoisha },
            { label: 'Electricity', poisha: totals.energyPoisha },
          ].map((t) => (
            <div key={t.label} className="rounded-lg border border-line bg-surface-raised p-4">
              <p className="text-overline uppercase text-ink-muted">{t.label}</p>
              <p className="mt-1 font-display text-h1 text-ink">
                <Money poisha={t.poisha} />
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-body">
          <thead className="bg-surface-sunken text-caption text-ink-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Invoice</th>
              <th className="px-4 py-2 text-left font-medium">Issued</th>
              <th className="px-4 py-2 text-left font-medium">Space</th>
              <th className="px-4 py-2 text-right font-medium">VAT</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv._id} className="border-t border-line">
                <td className="px-4 py-3">
                  <Link href={`/bookings/${inv.bookingId}/invoice`} className="numeric text-ink-brand underline">
                    {inv.invoiceNo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-caption text-ink-muted">{formatDate(inv.issuedAt)}</td>
                <td className="max-w-[220px] truncate px-4 py-3 text-ink">
                  {inv.propertySnapshot?.title || '—'}
                </td>
                <td className="px-4 py-3 text-right"><Money poisha={inv.vatPoisha} /></td>
                <td className="px-4 py-3 text-right"><Money poisha={inv.totalPoisha} /></td>
                <td className="px-4 py-3 text-right">
                  <DownloadInvoiceButton invoiceId={inv._id} invoiceNo={inv.invoiceNo} size="sm" variant="ghost" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
