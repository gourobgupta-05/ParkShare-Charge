'use client';
/**
 * TOP-UP MODAL — OWNER: Tamal Deb Nath [TDN]
 * Amounts are entered in taka and converted to poisha at the boundary, so no
 * float ever reaches the API.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import { formatMoney } from '@/lib/formatters';

const QUICK_TAKA = [200, 500, 1000, 2000];

export default function TopUpModal({ open, onClose, onTopUp }) {
  const [taka, setTaka] = useState('500');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  if (!open) return null;

  const amountPoisha = Math.round(Number(taka || 0) * 100);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await onTopUp(amountPoisha);
      if (result?.redirected) return;
      setDone(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setDone(null);
    setError(null);
    onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-secondary/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Add money to wallet"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-xl border border-line bg-surface-raised p-5 shadow-3"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <h2 className="text-h2 text-ink">Wallet topped up</h2>
            <p className="mt-2 text-body text-ink-muted">
              {formatMoney(done.amountPoisha)} added. New balance{' '}
              <span className="numeric font-medium text-ink">{formatMoney(done.balancePoisha)}</span>.
            </p>
            <Button className="mt-5" fullWidth onClick={close}>Done</Button>
          </>
        ) : (
          <>
            <h2 className="text-h2 text-ink">Add money</h2>
            <p className="mt-1 text-caption text-ink-muted">
              Funds sit in your wallet until a booking moves them into escrow.
            </p>

            {error && <Alert tone="danger" className="mt-4">{error}</Alert>}

            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_TAKA.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTaka(String(v))}
                  className={`numeric rounded-full border px-3 py-1.5 text-caption font-medium transition-colors duration-fast ${
                    Number(taka) === v
                      ? 'border-brand-primary bg-brand-primary-subtle text-ink-brand'
                      : 'border-line text-ink-muted hover:border-line-strong'
                  }`}
                >
                  ৳{v}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <Input
                label="Amount (BDT)"
                type="number"
                min="100"
                step="10"
                value={taka}
                onChange={(e) => setTaka(e.target.value)}
                hint="Minimum ৳100"
              />
            </div>

            <div className="mt-5 flex gap-3">
              <Button variant="outline" fullWidth onClick={close}>Cancel</Button>
              <Button fullWidth onClick={submit} isLoading={busy} disabled={amountPoisha < 10000}>
                Add {formatMoney(amountPoisha)}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
