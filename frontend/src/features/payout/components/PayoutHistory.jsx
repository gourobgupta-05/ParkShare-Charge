'use client';
/**
 * PAYOUT HISTORY — OWNER: S. Moontaha Rahman [SMR]
 * Settlements and withdrawals, with the commission shown per line.
 */
import Money from '@/components/ui/Money';
import EmptyState from '@/components/ui/EmptyState';
import { formatDateTime, cn } from '@/lib/formatters';

const STATUS_STYLES = {
  SETTLED: 'bg-success-subtle text-success-fg',
  REQUESTED: 'bg-warning-subtle text-warning-fg',
  PAID: 'bg-brand-primary text-white',
  FAILED: 'bg-danger text-white',
};

export default function PayoutHistory({ batches = [] }) {
  if (!batches.length) {
    return (
      <EmptyState
        title="No payouts yet"
        description="Earnings appear here once a driver completes a session at your space."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line">
      {batches.map((b) => (
        <li key={b._id} className="flex items-start justify-between gap-3 bg-surface-raised px-4 py-3">
          <div className="min-w-0">
            <p className="text-body text-ink">
              {b.kind === 'WITHDRAWAL' ? 'Withdrawal' : 'Session settlement'}
            </p>
            <p className="text-caption text-ink-muted">{formatDateTime(b.createdAt)}</p>
            {b.kind === 'SETTLEMENT' && (
              <p className="numeric mt-0.5 text-caption text-ink-subtle">
                Gross <Money poisha={b.grossPoisha} className="text-inherit" /> · commission{' '}
                <Money poisha={b.commissionPoisha} className="text-inherit" /> (
                {(b.commissionRate * 100).toFixed(0)}%)
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Money poisha={b.hostCreditPoisha} emphasis />
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-caption font-medium',
                STATUS_STYLES[b.status] || STATUS_STYLES.SETTLED
              )}
            >
              {b.status.toLowerCase()}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
