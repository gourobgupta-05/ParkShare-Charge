'use client';
/**
 * ACCOUNT LOCKED MODAL — OWNER: S. Moontaha Rahman [SMR]
 * Shown when a driver hits a locked account. Always offers the way out —
 * a lock with no visible resolution is a support ticket, not a deterrent.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Money from '@/components/ui/Money';
import { formatMoney } from '@/lib/formatters';
import { payPenalty } from '../api/penalty.api';

export default function AccountLockedModal({ penalty, open, onClose, onSettled }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [shortfall, setShortfall] = useState(null);

  if (!open || !penalty) return null;

  async function pay() {
    setBusy(true);
    setError(null);
    setShortfall(null);
    try {
      const data = await payPenalty(penalty._id);
      onSettled?.(data);
      onClose?.();
    } catch (err) {
      setError(err.message);
      if (err.details?.requiredPoisha && err.details?.balancePoisha !== undefined) {
        setShortfall(err.details.requiredPoisha - err.details.balancePoisha);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-secondary/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Account locked"
    >
      <div className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-5 shadow-3">
        <h2 className="text-h2 text-ink">Account locked</h2>
        <p className="mt-2 text-body text-ink-muted">
          You overstayed by <span className="numeric">{penalty.lateMinutes} min</span> on a previous
          booking. Settle the penalty to book again.
        </p>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-sunken px-4 py-3">
          <span className="text-body text-ink">Amount owed</span>
          <Money poisha={penalty.accruedPoisha} emphasis className="text-h2 text-danger-fg" />
        </div>

        {error && (
          <Alert tone="danger" className="mt-4">
            {error}
            {shortfall !== null && (
              <p className="mt-1">
                Top up {formatMoney(shortfall)} in your wallet, then try again.
              </p>
            )}
          </Alert>
        )}

        <div className="mt-5 flex gap-3">
          <Button variant="outline" fullWidth onClick={onClose}>
            Later
          </Button>
          <Button fullWidth onClick={pay} isLoading={busy}>
            Pay {formatMoney(penalty.accruedPoisha)}
          </Button>
        </div>
      </div>
    </div>
  );
}
