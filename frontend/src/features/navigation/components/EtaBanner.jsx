'use client';
/**
 * ETA BANNER — OWNER: Maidul Islam [MI]
 * The one number the driver actually looks at while moving, so it is the
 * largest thing on the screen.
 */
import { formatDistance, cn } from '@/lib/formatters';

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return { value: '0', unit: 'min' };
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return { value: String(minutes), unit: minutes === 1 ? 'min' : 'min' };
  return { value: `${Math.floor(minutes / 60)}h ${minutes % 60}`, unit: 'min' };
}

export default function EtaBanner({ route, hasArrived, isSimulated }) {
  if (hasArrived) {
    return (
      <div className="rounded-lg bg-brand-primary px-4 py-4 text-center text-white shadow-glow-charge">
        <p className="font-display text-h1">You have arrived</p>
        <p className="mt-1 text-caption opacity-90">Check in at the entrance to start your session</p>
      </div>
    );
  }

  if (!route) return null;

  const eta = formatEta(route.etaSeconds);
  const arrivalAt = route.etaAt ? new Date(route.etaAt) : null;

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-overline uppercase text-ink-muted">Arriving in</p>
          <p className="font-display text-display-lg text-ink">
            <span className="numeric">{eta.value}</span>
            <span className="ml-1 text-h2 text-ink-muted">{eta.unit}</span>
          </p>
        </div>

        <div className="text-right">
          <p className="numeric text-h3 text-ink">{formatDistance(route.distanceMeters || 0)}</p>
          {arrivalAt && (
            <p className="numeric text-caption text-ink-muted">
              {arrivalAt.toLocaleTimeString('en-GB', {
                timeZone: 'Asia/Dhaka',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>

      <div className={cn('mt-3 flex items-center justify-between border-t border-line pt-2')}>
        <span className="text-caption text-ink-subtle">
          {route.cached ? 'ETA cached' : 'ETA live'}
        </span>
        {isSimulated && (
          <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-caption font-medium text-warning-fg">
            Simulated route
          </span>
        )}
      </div>
    </div>
  );
}
