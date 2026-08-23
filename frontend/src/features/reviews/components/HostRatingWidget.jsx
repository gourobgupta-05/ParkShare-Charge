'use client';
/**
 * HOST RATING WIDGET — OWNER: Gourob Gupta [GG]
 * Average plus the star distribution. Percentages come from the API so the
 * bars always agree with the stored moving average.
 */
import StarRating from './StarRating';
import EmptyState from '@/components/ui/EmptyState';

export default function HostRatingWidget({ average = 0, count = 0, distribution = [], verifiedCount }) {
  if (!count) {
    return <EmptyState title="No reviews yet" description="Ratings appear here after the first completed session." />;
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="text-center sm:w-32">
        <p className="font-display text-display text-ink">{Number(average).toFixed(1)}</p>
        <StarRating value={average} showValue={false} size="sm" />
        <p className="numeric mt-1 text-caption text-ink-muted">
          {count} review{count === 1 ? '' : 's'}
        </p>
        {Number.isFinite(verifiedCount) && verifiedCount > 0 && (
          <p className="mt-1 text-caption text-ink-brand">{verifiedCount} verified</p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        {distribution.map((d) => (
          <div key={d.star} className="flex items-center gap-2">
            <span className="numeric w-3 text-caption text-ink-muted">{d.star}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-warning" style={{ width: `${d.percent}%` }} />
            </div>
            <span className="numeric w-8 text-right text-caption text-ink-subtle">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
