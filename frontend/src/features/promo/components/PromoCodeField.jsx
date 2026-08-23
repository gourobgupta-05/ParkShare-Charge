'use client';
/**
 * PROMO CODE FIELD — OWNER: Maidul Islam [MI]
 *
 * Applying a code writes booking.promo, then asks [GG]'s tariff engine to
 * re-price the booking so VAT is recalculated on the discounted subtotal.
 * That cross-feature call is a read-only import of another member's API
 * wrapper — this component never writes booking.pricing itself.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { formatMoney, cn } from '@/lib/formatters';
import { priceBooking } from '@/features/tariff/api/tariff.api';
import { applyCode, removeCode } from '../api/promo.api';

export default function PromoCodeField({ booking, onApplied }) {
  const applied = booking?.promo?.code;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  async function reprice() {
    // The tariff engine owns booking.pricing; it reads booking.promo.
    try {
      await priceBooking(booking._id);
    } catch {
      /* the checkout panel will surface a pricing problem if one persists */
    }
  }

  async function apply() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await applyCode(code.trim(), booking._id);
      await reprice();
      setSuccess(`${data.code} applied — ${formatMoney(data.discountPoisha)} off`);
      setCode('');
      onApplied?.(data);
    } catch (err) {
      setError(err.details?.code || err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await removeCode(booking._id);
      await reprice();
      onApplied?.(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-brand-primary bg-brand-primary-subtle px-3 py-2.5">
        <div className="min-w-0">
          <p className="numeric text-body font-medium text-ink-brand">{applied}</p>
          <p className="text-caption text-ink-muted">
            {formatMoney(booking.promo.discountPoisha)} off this booking
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={remove} isLoading={busy}>
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="promo-code" className="text-caption font-medium text-ink">
        Promo code
      </label>

      <div className="flex gap-2">
        <input
          id="promo-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && code.trim() && apply()}
          placeholder={process.env.NEXT_PUBLIC_PROMO_PLACEHOLDER || 'JAMUNA20'}
          maxLength={24}
          className={cn(
            'numeric h-10 flex-1 rounded border bg-surface px-3 text-body uppercase text-ink',
            'placeholder:text-ink-subtle',
            error ? 'border-danger' : 'border-line'
          )}
        />
        <Button onClick={apply} isLoading={busy} disabled={!code.trim()} variant="outline">
          Apply
        </Button>
      </div>

      {error && <p className="text-caption text-danger-fg">{error}</p>}
      {success && <Alert tone="success">{success}</Alert>}
    </div>
  );
}
