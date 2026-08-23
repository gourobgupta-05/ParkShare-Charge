'use client';
/**
 * HOST CALENDAR — OWNER: Gourob Gupta [GG]
 */
import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import AvailabilityEditor from '@/features/calendar/components/AvailabilityEditor';
import { getMyCalendars } from '@/features/calendar/api/calendar.api';

function AvailabilityScreen() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setIsLoading(true);
    getMyCalendars()
      .then((d) => setItems(d.items || []))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Availability</h1>
        <p className="mt-1 text-body text-ink-muted">
          Set the hours drivers can book, in 30-minute steps. Times are Dhaka local.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <div className="py-10"><Spinner label="Loading your spaces" /></div>
      ) : items.length ? (
        items.map((p) => <AvailabilityEditor key={p._id} property={p} onSaved={load} />)
      ) : (
        <EmptyState
          title="No spaces listed yet"
          description="Once you list a space it will appear here so you can open its calendar."
        />
      )}
    </main>
  );
}

export default function HostAvailabilityPage() {
  return (
    <ProtectedRoute roles={[ROLES.HOST, ROLES.ADMIN]}>
      <AvailabilityScreen />
    </ProtectedRoute>
  );
}
