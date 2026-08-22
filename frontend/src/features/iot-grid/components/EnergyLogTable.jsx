'use client';
/**
 * ENERGY LOG TABLE — OWNER: Maidul Islam [MI]
 * Host-side history of every charging session across their spaces.
 */
import Money from '@/components/ui/Money';
import EmptyState from '@/components/ui/EmptyState';
import { formatDateTime, cn } from '@/lib/formatters';

const STATUS_STYLES = {
  CHARGING: 'bg-brand-primary text-white animate-charge-pulse',
  PAUSED: 'bg-warning text-white',
  STOPPED: 'bg-surface-sunken text-ink-muted',
  IDLE: 'bg-surface-sunken text-ink-muted',
  FAULT: 'bg-danger text-white',
};

export default function EnergyLogTable({ sessions = [], totals }) {
  if (!sessions.length) {
    return (
      <EmptyState
        title="No charging sessions yet"
        description="Energy logs appear here once a driver charges at one of your spaces."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {totals && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface-raised p-4">
            <p className="text-overline uppercase text-ink-muted">Energy delivered</p>
            <p className="numeric mt-1 font-display text-h1 text-ink">
              {Number(totals.totalKwh || 0).toFixed(1)}
              <span className="ml-1 text-body text-ink-muted">kWh</span>
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface-raised p-4">
            <p className="text-overline uppercase text-ink-muted">Electricity billed</p>
            <p className="mt-1 font-display text-h1 text-ink">
              <Money poisha={totals.energyCostPoisha || 0} />
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface-raised p-4">
            <p className="text-overline uppercase text-ink-muted">Peak draw</p>
            <p className="numeric mt-1 font-display text-h1 text-ink">
              {Number(totals.peakKw || 0).toFixed(1)}
              <span className="ml-1 text-body text-ink-muted">kW</span>
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-body">
          <thead className="bg-surface-sunken text-caption text-ink-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Space</th>
              <th className="px-4 py-2 text-left font-medium">Started</th>
              <th className="px-4 py-2 text-right font-medium">Energy</th>
              <th className="px-4 py-2 text-right font-medium">Peak</th>
              <th className="px-4 py-2 text-right font-medium">Billed</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s._id} className="border-t border-line">
                <td className="max-w-[200px] truncate px-4 py-3 text-ink">{s.propertyTitle || '—'}</td>
                <td className="px-4 py-3 text-caption text-ink-muted">
                  {s.startedAt ? formatDateTime(s.startedAt) : '—'}
                </td>
                <td className="numeric px-4 py-3 text-right text-ink">
                  {Number(s.totalKwh || 0).toFixed(2)} kWh
                </td>
                <td className="numeric px-4 py-3 text-right text-ink-muted">
                  {Number(s.peakKw || 0).toFixed(1)} kW
                </td>
                <td className="px-4 py-3 text-right">
                  <Money poisha={s.energyCostPoisha || 0} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium',
                      STATUS_STYLES[s.status] || STATUS_STYLES.IDLE
                    )}
                  >
                    {s.status.toLowerCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
