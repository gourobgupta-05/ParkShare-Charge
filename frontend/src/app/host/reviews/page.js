'use client';
/**
 * HOST REVIEWS — OWNER: Gourob Gupta [GG]
 * The host's own rating plus every review, with a reply box.
 */
import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Card, { CardBody } from '@/components/ui/Card';
import { formatDate } from '@/lib/formatters';
import StarRating from '@/features/reviews/components/StarRating';
import { listForHost, replyToReview } from '@/features/reviews/api/review.api';

function ReplyBox({ review, onReplied }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (review.hostReply?.body) {
    return (
      <div className="mt-3 rounded border-l-2 border-brand-primary bg-brand-primary-subtle px-3 py-2">
        <p className="text-caption font-medium text-ink-brand">Your reply</p>
        <p className="mt-0.5 text-caption text-ink">{review.hostReply.body}</p>
      </div>
    );
  }

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await replyToReview(review._id, body);
      onReplied?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      {error && <Alert tone="danger" className="mb-2">{error}</Alert>}
      <textarea
        rows={2}
        maxLength={600}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Reply publicly…"
        className="w-full rounded border border-line bg-surface px-3 py-2 text-caption text-ink placeholder:text-ink-subtle"
      />
      <Button size="sm" className="mt-2" onClick={send} isLoading={busy} disabled={body.trim().length < 5}>
        Post reply
      </Button>
    </div>
  );
}

function HostReviewsScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setIsLoading(true);
    listForHost(user._id)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [user._id]);

  useEffect(load, [load]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Your reviews</h1>
        <p className="mt-1 text-body text-ink-muted">Feedback from drivers after completed sessions</p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <div className="py-10"><Spinner label="Loading reviews" /></div>
      ) : (
        <>
          <Card>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-overline uppercase text-ink-muted">Overall rating</p>
                <p className="mt-1 font-display text-display text-ink">
                  {Number(data?.host?.avgRating || 0).toFixed(1)}
                </p>
                <p className="numeric text-caption text-ink-muted">
                  {data?.host?.ratingCount || 0} review{data?.host?.ratingCount === 1 ? '' : 's'}
                </p>
              </div>
              <StarRating value={data?.host?.avgRating || 0} showValue={false} />
            </CardBody>
          </Card>

          {data?.items?.length ? (
            <ul className="flex flex-col gap-4">
              {data.items.map((r) => (
                <li key={r._id} className="rounded-lg border border-line bg-surface-raised p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-body font-medium text-ink">{r.driverId?.name || 'Driver'}</p>
                      <p className="text-caption text-ink-subtle">
                        {r.propertyId?.title} · {formatDate(r.createdAt)}
                      </p>
                    </div>
                    <StarRating value={r.rating} size="sm" showValue={false} />
                  </div>
                  {r.comment && <p className="mt-2 text-body text-ink">{r.comment}</p>}
                  <ReplyBox review={r} onReplied={load} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No reviews yet" description="Reviews appear here after drivers complete a session." />
          )}
        </>
      )}
    </main>
  );
}

export default function HostReviewsPage() {
  return (
    <ProtectedRoute roles={[ROLES.HOST]}>
      <HostReviewsScreen />
    </ProtectedRoute>
  );
}
