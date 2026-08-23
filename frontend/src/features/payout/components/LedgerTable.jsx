'use client';
/**
 * LEDGER TABLE — OWNER: S. Moontaha Rahman [SMR]
 * The append-only audit trail, rendered. Every line is immutable — a refund
 * appends a reversing entry rather than editing the original.
 */
import Money from '@/components/ui/Money';
import EmptyState from '@/components/ui/EmptyState';
import { formatDateTime, cn } from '@/lib/formatters';

const TYPE_LABELS = {
  TOPUP: 'Wallet top-up',
  ESCROW_HOLD: 'Held in escrow',
  ESCROW_RELEASE: 'Released from escrow',
  HOST_CREDIT: 'Earnings credited',
  PLATFORM_COMMISSION: 'Platform commission',
  PENALTY_DEBIT: 'Overstay penalty',
  REFUND: 'Refund',
  PAYOUT: 'Withdrawal',
};

export default function LedgerTable({ entries = [] }) {
  if (!entries.length) {
    return <EmptyState title="No ledger entries yet" description="Money movements appear here as they happen." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-body">
        <thead className="bg-surface-sunken text-caption text-ink-muted">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Movement</th>
            <th className="px-4 py-2 text-left font-medium">When</th>
            <th className="px-4 py-2 text-right font-medium">Amount</th>
            <th className="px-4 py-2 text-right font-medium">Balance after</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e._id} className="border-t border-line">
              <td className="px-4 py-3">
                <p className="text-ink">{TYPE_LABELS[e.type] || e.type.replace(/_/g, ' ').toLowerCase()}</p>
                {e.note && <p className="text-caption text-ink-subtle">{e.note}</p>}
              </td>
              <td className="px-4 py-3 text-caption text-ink-muted">{formatDateTime(e.createdAt)}</td>
              <td
                className={cn(
                  'px-4 py-3 text-right',
                  e.direction === 'IN' ? 'text-ink-brand' : e.direction === 'OUT' ? 'text-danger-fg' : 'text-ink'
                )}
              >
                {e.direction === 'IN' ? '+' : e.direction === 'OUT' ? '−' : ''}
                <Money poisha={e.amountPoisha} className="text-inherit" />
              </td>
              <td className="px-4 py-3 text-right text-ink-muted">
                {Number.isFinite(e.balanceAfterPoisha) ? <Money poisha={e.balanceAfterPoisha} /> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
