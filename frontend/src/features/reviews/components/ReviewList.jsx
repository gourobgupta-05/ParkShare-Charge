'use client';
/**
 * REVIEW LIST — OWNER: Gourob Gupta [GG]
 */
import { useEffect, useState } from 'react';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/formatters';
import StarRating from './StarRating';
import HostRatingWidget from './HostRatingWidget';
import { listForProperty } from '../api/review.api';

export default function ReviewList({ propertyId, showSummary = true, limit = 5 }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('recent');

  useEffect(() => {
    if (!propertyId) return undefined;
    let cancelled = false;

    setIsLoading(true);
    listForProperty(propertyId, { limit, sort })
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setIsLoading(false));

    return () => { cancelled = true; };
  }, [propertyId, limit, sort]);

  if (isLoading && !data) return <div className="py-6"><Spinner label="Loading reviews" /></div>;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data?.total) {
    return <EmptyState title="No reviews yet" description="Be the first to review this space after your session." />;
  }

  const average =
    data.distribution.reduce((sum, d) => sum + d.star * d.count, 0) /
    Math.max(data.distribution.reduce((sum, d) => sum + d.count, 0), 1);

  return (
    <div className="flex flex-col gap-4">
      {showSummary && (
        <HostRatingWidget
          average={average}
          count={data.total}
          distribution={data.distribution}
          verifiedCount={data.verifiedCount}
        />
      )}

      <div className="flex items-center justify-between border-t border-line pt-3">
        <p className="text-caption text-ink-muted">Showing {data.items.length} of {data.total}</p>
        <select
          aria-label="Sort reviews"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-8 rounded border border-line bg-surface px-2 text-caption text-ink"
        >
          <option value="recent">Most recent</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
        </select>
      </div>

      <ul className="flex flex-col gap-4">
        {data.items.map((r) => (
          <li key={r._id} className="border-b border-line pb-4 last:border-b-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-body font-medium text-ink">{r.driverId?.name || 'Driver'}</p>
                <p className="text-caption text-ink-subtle">
                  {formatDate(r.createdAt)}
                  {r.isEdited && ' · edited'}
                </p>
              </div>
              <StarRating value={r.rating} size="sm" showValue={false} />
            </div>

            {r.verification?.isVerifiedSession && (
              <span className="mt-2 inline-flex items-center rounded-full bg-success-subtle px-2 py-0.5 text-caption font-medium text-success-fg">
                Verified session
                {r.verification.sessionKwh > 0 && ` · ${r.verification.sessionKwh.toFixed(1)} kWh`}
              </span>
            )}

            {r.comment && <p className="mt-2 text-body text-ink">{r.comment}</p>}

            {r.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.tags.map((t) => (
                  <span key={t} className="rounded-full bg-surface-sunken px-2 py-0.5 text-caption text-ink-muted">
                    {t.replace(/_/g, ' ').toLowerCase()}
                  </span>
                ))}
              </div>
            )}

            {r.hostReply?.body && (
              <div className="mt-3 rounded border-l-2 border-brand-primary bg-brand-primary-subtle px-3 py-2">
                <p className="text-caption font-medium text-ink-brand">Host replied</p>
                <p className="mt-0.5 text-caption text-ink">{r.hostReply.body}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
