'use client';

import { useState } from 'react';
import FeedbackMatrix from '@/components/feedback/FeedbackMatrix';

/**
 * Demo/testing page for Gourob Gupta's Module 1 feature:
 * F1 - Driver-Side Post-Session Feedback & Verification Matrix
 *
 * Route: /feedback-demo
 * Owned entirely by Gourob — teammates add their own route folders
 * under src/app/ instead of editing this file.
 */
export default function FeedbackDemoPage() {
  const [open, setOpen] = useState(false);
  const [lastResult, setLastResult] = useState<unknown>(null);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start gap-4 px-6 py-16">
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        Module 1 — Gourob Gupta
      </span>
      <h1 className="text-2xl font-semibold text-slate-900">
        Driver-Side Post-Session Feedback &amp; Verification Matrix
      </h1>
      <p className="text-sm text-slate-500">
        Click below to open the feedback modal. It calls{' '}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          POST {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/feedback
        </code>{' '}
        on the backend.
      </p>

      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Leave a review
      </button>

      {lastResult ? (
        <pre className="w-full overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-emerald-300">
          {JSON.stringify(lastResult, null, 2)}
        </pre>
      ) : null}

      <FeedbackMatrix
        isOpen={open}
        onClose={() => setOpen(false)}
        sessionId="66c1f2a4e4b0a1b2c3d4e5f6"
        driverId="66c1f2a4e4b0a1b2c3d4e5f7"
        hostId="66c1f2a4e4b0a1b2c3d4e5f8"
        onSubmitted={(data) => setLastResult(data)}
      />
    </main>
  );
}
