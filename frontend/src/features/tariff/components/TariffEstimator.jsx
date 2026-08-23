'use client';
/**
 * TARIFF ESTIMATOR — OWNER: Gourob Gupta [GG]
 * Live fare preview for the window the driver has selected, before any
 * booking exists. Debounced so dragging across the slot grid doesn't spam
 * the API.
 */
import { useEffect, useState } from 'react';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import FareBreakdown from './FareBreakdown';
import { estimate } from '../api/tariff.api';

export default function TariffEstimator({ propertyId, selection, promoDiscountPoisha = 0 }) {
  const [breakdown, setBreakdown] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!propertyId || !selection?.startAt || !selection?.endAt) {
      setBreakdown(null);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      estimate({
        propertyId,
        startAt: selection.startAt,
        endAt: selection.endAt,
        promoDiscountPoisha,
      })
        .then((data) => !cancelled && setBreakdown(data))
        .catch((err) => {
          if (cancelled) return;
          setError(err.message);
          setBreakdown(null);
        })
        .finally(() => !cancelled && setIsLoading(false));
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setIsLoading(false);
    };
  }, [propertyId, selection?.startAt, selection?.endAt, promoDiscountPoisha]);

  if (!selection) return null;

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-4">
      <h3 className="text-h3 text-ink">Estimated fare</h3>
      <p className="mt-0.5 text-caption text-ink-muted">
        Electricity is charged against BERC peak and off-peak rates for the hours you book.
      </p>

      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}

      {isLoading && !breakdown && (
        <div className="py-6"><Spinner label="Working out the fare" /></div>
      )}

      {breakdown && (
        <div className={isLoading ? 'mt-3 opacity-60 transition-opacity duration-fast' : 'mt-3'}>
          <FareBreakdown breakdown={breakdown} />
        </div>
      )}
    </div>
  );
}
