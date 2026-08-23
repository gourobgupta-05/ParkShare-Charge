'use client';
/**
 * MY BOOKINGS — OWNER: Gourob Gupta [GG]
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { ROLES, BOOKING_STATUS } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import UpcomingBookings from '@/features/calendar/components/UpcomingBookings';
import { listBookings } from '@/features/calendar/api/calendar.api';

const FILTERS = [
  { value: '', label: 'All' },
  { value: BOOKING_STATUS.PENDING_PAYMENT, label: 'Unpaid' },
  { value: BOOKING_STATUS.CONFIRMED, label: 'Confirmed' },
  { value: BOOKING_STATUS.ACTIVE, label: 'Active' },
  { value: BOOKING_STATUS.COMPLETED, label: 'Completed' },
];

function BookingsScreen() {
  const { user } = useAuth();
  const isHost = user.role === ROLES.HOST;
  const scope = isHost ? 'host' : 'driver';

  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    listBookings({ scope, status: status || undefined })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [scope, status]);

  useEffect(load, [load]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-h1">{isHost ? 'Bookings on your spaces' : 'Your bookings'}</h1>
          <p className="mt-1 text-body text-ink-muted">
            {isHost ? 'Sessions drivers have booked with you' : 'Upcoming and past sessions'}
          </p>
        </div>
        {!isHost && (
          <Link href="/search"><Button size="sm" variant="outline">Find parking</Button></Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`rounded-full border px-3 py-1.5 text-caption font-medium transition-colors duration-fast ${
              status === f.value
                ? 'border-brand-primary bg-brand-primary-subtle text-ink-brand'
                : 'border-line text-ink-muted hover:border-line-strong'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <div className="py-10"><Spinner label="Loading your bookings" /></div>
      ) : (
        <UpcomingBookings
          bookings={data?.items || []}
          scope={scope}
          emptyAction={
            !isHost && <Link href="/search"><Button size="sm">Find a space</Button></Link>
          }
        />
      )}
    </main>
  );
}

export default function BookingsPage() {
  return (
    <ProtectedRoute>
      <BookingsScreen />
    </ProtectedRoute>
  );
}
