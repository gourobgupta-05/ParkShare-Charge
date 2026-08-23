'use client';
/**
 * HOST OPENING HOURS — OWNER: Tamal Deb Nath [TDN]
 * Mall managers set the closing time that the guard enforces.
 */
import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import OperatingHoursEditor from '@/features/mall-hours/components/OperatingHoursEditor';
import { getMyProperties } from '@/features/mall-hours/api/mallHours.api';

function HoursScreen() {
  const [properties, setProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setIsLoading(true);
    getMyProperties()
      .then((d) => setProperties(d.items || []))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Opening hours</h1>
        <p className="mt-1 text-body text-ink-muted">
          Bookings that would run past closing time are rejected automatically. Times are Dhaka local.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <div className="py-10"><Spinner label="Loading your spaces" /></div>
      ) : properties.length ? (
        properties.map((p) => <OperatingHoursEditor key={p._id} property={p} onSaved={load} />)
      ) : (
        <EmptyState
          title="No spaces listed yet"
          description="Once you list a space it will appear here so you can set its opening hours."
        />
      )}
    </main>
  );
}

export default function HostHoursPage() {
  return (
    <ProtectedRoute roles={[ROLES.HOST, ROLES.ADMIN]}>
      <HoursScreen />
    </ProtectedRoute>
  );
}
