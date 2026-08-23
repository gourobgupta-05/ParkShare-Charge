'use client';
/**
 * FARE BREAKDOWN — OWNER: Gourob Gupta [GG]
 * The itemised fare. Escrow reads exactly these figures, so what the driver
 * sees here is what the wallet is charged.
 */
import Money from '@/components/ui/Money';
import PeakOffPeakBadge from './PeakOffPeakBadge';
import { formatMoney, cn } from '@/lib/formatters';

function Row({ label, poisha, detail, muted, negative }) {
  if (!poisha) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="min-w-0">
        <span className={muted ? 'text-caption text-ink-muted' : 'text-body text-ink'}>{label}</span>
        {detail && <p className="text-caption text-ink-subtle">{detail}</p>}
      </div>
      <span className={cn('numeric shrink-0', muted ? 'text-caption text-ink-muted' : 'text-body text-ink')}>
        {negative ? '−' : ''}
        {formatMoney(poisha)}
      </span>
    </div>
  );
}

export default function FareBreakdown({ breakdown, showPeriods = true, compact = false }) {
  if (!breakdown) return null;

  const {
    basePoisha, energyPoisha, discountPoisha, vatPoisha, processingFeePoisha,
    totalPoisha, vatRate, estimatedKwh, periods, rateVersion, durationMinutes,
  } = breakdown;

  return (
    <div className="flex flex-col">
      <Row
        label="Parking fee"
        poisha={basePoisha}
        detail={durationMinutes ? `${(durationMinutes / 60).toFixed(1)} hours` : null}
      />
      <Row
        label="Electricity"
        poisha={energyPoisha}
        detail={estimatedKwh ? `${Number(estimatedKwh).toFixed(2)} kWh at BERC rates` : null}
      />

      {showPeriods && periods?.length > 0 && (
        <div className="my-2 flex flex-col gap-1.5 rounded border border-line bg-surface-sunken p-3">
          {periods.map((p) => (
            <div key={`${p.period}-${p.minutes}`} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <PeakOffPeakBadge period={p.period} />
                <span className="numeric text-caption text-ink-muted">
                  {Number(p.kwh).toFixed(2)} kWh · {p.hours} h
                </span>
              </span>
              <span className="numeric text-caption text-ink">
                {formatMoney(p.effectivePoishaPerKwh)}/kWh
              </span>
            </div>
          ))}
          {rateVersion && (
            <p className="mt-1 text-caption text-ink-subtle">BERC rate set {rateVersion}</p>
          )}
        </div>
      )}

      <Row label="Promo discount" poisha={discountPoisha} muted negative />
      <Row
        label="VAT"
        poisha={vatPoisha}
        detail={vatRate ? `${(vatRate * 100).toFixed(0)}% of taxable amount` : null}
        muted
      />
      <Row label="Processing fee" poisha={processingFeePoisha} muted />

      <div className={cn('mt-2 flex items-center justify-between border-t border-line-strong pt-3')}>
        <span className={compact ? 'text-body font-medium text-ink' : 'text-h3 text-ink'}>Total</span>
        <Money poisha={totalPoisha} emphasis className={compact ? undefined : 'text-h2'} />
      </div>
    </div>
  );
}
