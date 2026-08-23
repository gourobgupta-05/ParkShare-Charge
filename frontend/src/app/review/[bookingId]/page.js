'use client';
/**
 * LEAVE A REVIEW — OWNER: Gourob Gupta [GG]
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import ReviewForm from '@/features/reviews/components/ReviewForm';
import { getBooking } from '@/features/calendar/api/calendar.api';

function ReviewScreen() {
  const { bookingId } = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getBooking(bookingId)
      .then(setBooking)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [bookingId]);

  if (isLoading) {
    return <main className="flex min-h-[60vh] items-center justify-center"><Spinner label="Loading session" /></main>;
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
      <Link href="/bookings" className="text-caption text-ink-muted underline hover:text-ink">
        ← Your bookings
      </Link>

      {error && <Alert tone="danger">{error}</Alert>}

      {done ? (
        <Alert tone="success">
          Thanks — your review is live and the host&apos;s rating has been updated.
          <div className="mt-3">
            <Button size="sm" onClick={() => router.push('/bookings')}>Back to bookings</Button>
          </div>
        </Alert>
      ) : (
        booking && <ReviewForm booking={booking} onSubmitted={() => setDone(true)} />
      )}
    </main>
  );
}

export default function ReviewPage() {
  return (
    <ProtectedRoute roles={[ROLES.DRIVER]}>
      <ReviewScreen />
    </ProtectedRoute>
  );
}
