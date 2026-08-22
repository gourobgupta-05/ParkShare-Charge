'use client';
/**
 * OFFER STRIP — OWNER: Maidul Islam [MI]
 * Live partner campaigns. Tapping one fills the promo field rather than
 * applying silently, so the driver stays in control of their own checkout.
 */
import { useEffect, useState } from 'react';
import { formatMoney } from '@/lib/formatters';
import { listActive } from '../api/promo.api';

export default function OfferStrip({ propertyType, onPick }) {
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    listActive(propertyType)
      .then((data) => !cancelled && setOffers(data.items || []))
      .catch(() => !cancelled && setOffers([])); // offers are a bonus, never a blocker
    return () => { cancelled = true; };
  }, [propertyType]);

  if (!offers.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-overline uppercase text-ink-muted">Partner offers</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {offers.map((o) => (
          <button
            key={o.code}
            type="button"
            onClick={() => onPick?.(o.code)}
            className="flex min-w-[160px] shrink-0 flex-col items-start rounded-lg border border-brand-accent/30 bg-brand-accent-subtle px-3 py-2 text-left transition-colors duration-fast hover:border-brand-accent"
          >
            <span className="numeric text-body font-medium text-ink">{o.code}</span>
            <span className="text-caption text-ink-brand">{formatMoney(o.discountPoisha)} off</span>
            {o.partnerName && (
              <span className="mt-0.5 truncate text-caption text-ink-muted">{o.partnerName}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
