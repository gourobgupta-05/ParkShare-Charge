'use client';
/**
 * REVIEW FORM — OWNER: Gourob Gupta [GG]
 * Collects the overall score, optional sub-scores, tags and a comment.
 * Only the overall rating is required — forcing five sub-scores to leave any
 * feedback is how review systems end up with no reviews.
 */
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/formatters';
import StarRating from './StarRating';
import { createReview, getTags } from '../api/review.api';

const SUB_FIELDS = [
  { key: 'accuracy', label: 'Matched the listing' },
  { key: 'access', label: 'Easy to get in and out' },
  { key: 'cleanliness', label: 'Condition of the space' },
  { key: 'charging', label: 'Charging experience' },
];

export default function ReviewForm({ booking, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [subRatings, setSubRatings] = useState({});
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState([]);
  const [available, setAvailable] = useState([]);
  const [minLength, setMinLength] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    getTags()
      .then((d) => {
        setAvailable(d.tags || []);
        setMinLength(d.minCommentLength || 10);
      })
      .catch(() => setAvailable([]));
  }, []);

  const toggleTag = (tag) =>
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : t.length < 5 ? [...t, tag] : t));

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const review = await createReview({
        bookingId: booking._id,
        rating,
        comment: comment.trim(),
        tags,
        subRatings,
      });
      onSubmitted?.(review);
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.details || {});
    } finally {
      setBusy(false);
    }
  }

  const commentTooShort = comment.trim().length > 0 && comment.trim().length < minLength;

  return (
    <Card>
      <CardHeader
        title="How was it?"
        subtitle={booking?.propertyId?.title ? `Your session at ${booking.propertyId.title}` : undefined}
      />
      <CardBody className="flex flex-col gap-5">
        {error && <Alert tone="danger">{error}</Alert>}

        <div>
          <p className="text-caption font-medium text-ink">Overall rating</p>
          <div className="mt-2">
            <StarRating value={rating} onChange={setRating} size="lg" showValue={false} label="Overall rating" />
          </div>
          {fieldErrors.rating && <p className="mt-1 text-caption text-danger-fg">{fieldErrors.rating}</p>}
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="text-caption font-medium text-ink">
            More detail <span className="font-normal text-ink-muted">(optional)</span>
          </p>
          {SUB_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3">
              <span className="text-caption text-ink-muted">{f.label}</span>
              <StarRating
                value={subRatings[f.key] || 0}
                onChange={(v) => setSubRatings((s) => ({ ...s, [f.key]: v }))}
                size="sm"
                showValue={false}
                label={f.label}
              />
            </div>
          ))}
        </div>

        {available.length > 0 && (
          <div className="border-t border-line pt-4">
            <p className="text-caption font-medium text-ink">
              Tags <span className="font-normal text-ink-muted">(up to 5)</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {available.map((tag) => {
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-caption transition-colors duration-fast',
                      active
                        ? 'border-brand-primary bg-brand-primary-subtle text-ink-brand'
                        : 'border-line text-ink-muted hover:border-line-strong'
                    )}
                  >
                    {tag.replace(/_/g, ' ').toLowerCase()}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t border-line pt-4">
          <label htmlFor="review-comment" className="text-caption font-medium text-ink">
            Anything else? <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <textarea
            id="review-comment"
            rows={4}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What should the next driver know about this space?"
            className={cn(
              'mt-2 w-full rounded border bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-subtle',
              commentTooShort || fieldErrors.comment ? 'border-danger' : 'border-line'
            )}
          />
          <div className="mt-1 flex justify-between">
            <span className="text-caption text-danger-fg">
              {fieldErrors.comment || (commentTooShort ? `At least ${minLength} characters, or leave it blank` : '')}
            </span>
            <span className="numeric text-caption text-ink-subtle">{comment.length}/1000</span>
          </div>
        </div>

        <Button
          onClick={submit}
          isLoading={busy}
          disabled={rating < 1 || commentTooShort}
          fullWidth
          size="lg"
        >
          Post review
        </Button>
      </CardBody>
    </Card>
  );
}
