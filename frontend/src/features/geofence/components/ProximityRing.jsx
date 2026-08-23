'use client';
/**
 * PROXIMITY RING — OWNER: S. Moontaha Rahman [SMR]
 *
 * The visual of "how close am I". The ring fills as the driver approaches and
 * pulses once they are inside the fence — one of the three sanctioned uses of
 * the charge pulse, because crossing the fence is the moment the session goes
 * live.
 */
import { cn } from '@/lib/formatters';

const SIZE = 160;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export default function ProximityRing({ distanceMeters, radiusM = 15, isInside, isCheckedIn }) {
  // Full ring at 200 m or more, closing as the driver approaches.
  const OUTER = 200;
  const distance = Number.isFinite(distanceMeters) ? distanceMeters : OUTER;
  const progress = Math.max(0, Math.min(1 - (distance - radiusM) / (OUTER - radiusM), 1));
  const offset = CIRC * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn('relative', (isInside || isCheckedIn) && 'animate-charge-pulse rounded-full')}
        style={{ width: SIZE, height: SIZE }}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-full w-full -rotate-90"
          role="img"
          aria-label={`${Math.round(distance)} metres from the entrance`}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            className="stroke-line"
            strokeWidth={STROKE}
            fill="none"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            className={cn(
              'transition-all duration-slow',
              isCheckedIn || isInside ? 'stroke-brand-primary' : 'stroke-info'
            )}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            fill="none"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isCheckedIn ? (
            <>
              <span className="font-display text-h2 text-ink-brand">Checked in</span>
              <span className="text-caption text-ink-muted">Session active</span>
            </>
          ) : (
            <>
              <span className="numeric font-display text-display text-ink">
                {Math.round(distance)}
              </span>
              <span className="text-caption text-ink-muted">metres away</span>
            </>
          )}
        </div>
      </div>

      {!isCheckedIn && (
        <p className="text-caption text-ink-subtle">
          Check-in happens automatically within{' '}
          <span className="numeric">{radiusM} m</span>
        </p>
      )}
    </div>
  );
}
