'use client';

import { useState } from 'react';
import { Star, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * FeedbackMatrix
 * F1: Driver-Side Post-Session Feedback & Verification Matrix
 * Owner: Gourob Gupta — Module 1
 *
 * Submits to POST /api/feedback.
 *
 * Props:
 * - isOpen: boolean — controls modal visibility
 * - onClose: () => void
 * - sessionId, driverId, hostId: string (Mongo ObjectId strings)
 * - apiBaseUrl: string — defaults to NEXT_PUBLIC_API_URL
 * - onSubmitted: (data) => void — optional callback after a successful POST
 */

const METRICS = [
  { key: 'ratingReliability', label: 'Reliability', hint: 'Was the slot available and working as promised?' },
  { key: 'ratingSafety', label: 'Safety', hint: 'Did the location and equipment feel safe to use?' },
  { key: 'ratingEfficiency', label: 'Charger Efficiency', hint: 'How was the charging speed and power delivery?' },
];

function StarRow({ value, onChange, label, hint }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <span className="text-xs text-slate-400">{value > 0 ? `${value}/5` : 'Not rated'}</span>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = (hovered || value) >= n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} out of 5`}
              onClick={() => onChange(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              className="rounded-md p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Star
                size={26}
                strokeWidth={1.5}
                className={filled ? 'fill-emerald-500 text-emerald-500' : 'fill-transparent text-slate-300'}
              />
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">{hint}</p>
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const isSuccess = toast.type === 'success';
  return (
    <div
      role="status"
      className={`fixed bottom-6 right-6 z-[60] flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${
        isSuccess ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
      ) : (
        <AlertCircle size={20} className="mt-0.5 shrink-0 text-red-600" />
      )}
      <div>
        <p className={`text-sm font-medium ${isSuccess ? 'text-emerald-800' : 'text-red-800'}`}>
          {isSuccess ? 'Feedback submitted' : 'Something went wrong'}
        </p>
        <p className={`text-xs ${isSuccess ? 'text-emerald-700' : 'text-red-700'}`}>{toast.message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="ml-2 text-slate-400 hover:text-slate-600"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default function FeedbackMatrix({
  isOpen,
  onClose,
  sessionId,
  driverId,
  hostId,
  apiBaseUrl,
  onSubmitted,
}) {
  const [ratings, setRatings] = useState({
    ratingReliability: 0,
    ratingSafety: 0,
    ratingEfficiency: 0,
  });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const baseUrl = apiBaseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const allRated = Object.values(ratings).every((v) => v > 0);

  const resetForm = () => {
    setRatings({ ratingReliability: 0, ratingSafety: 0, ratingEfficiency: 0 });
    setComment('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allRated || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          driverId,
          hostId,
          ...ratings,
          comment: comment.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit feedback.');
      }

      setToast({ type: 'success', message: 'Thanks — your feedback updates the host rating instantly.' });
      onSubmitted?.(data.data);
      resetForm();
      setTimeout(() => {
        setToast(null);
        onClose?.();
      }, 1400);
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        >
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Rate your session</h2>
              <p className="text-sm text-slate-500">Your feedback updates this host's public rating.</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {METRICS.map((m) => (
              <StarRow
                key={m.key}
                label={m.label}
                hint={m.hint}
                value={ratings[m.key]}
                onChange={(v) => setRatings((prev) => ({ ...prev, [m.key]: v }))}
              />
            ))}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="comment" className="text-sm font-medium text-slate-800">
                Additional comments <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                id="comment"
                rows={3}
                maxLength={1000}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Anything the host or future drivers should know?"
                className="resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={!allRated || submitting}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit feedback'
              )}
            </button>
          </form>
        </div>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
