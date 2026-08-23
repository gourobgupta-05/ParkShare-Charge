'use client';
/**
 * HOST ENERGY LOGS — OWNER: Maidul Islam [MI]
 */
import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import EnergyLogTable from '@/features/iot-grid/components/EnergyLogTable';
import { getHostEnergyLogs } from '@/features/iot-grid/api/iot.api';

function EnergyScreen() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setIsLoading(true);
    getHostEnergyLogs()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Energy logs</h1>
        <p className="mt-1 text-body text-ink-muted">
          Every charging session across your spaces, metered by the charge point.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <div className="py-10"><Spinner label="Loading energy logs" /></div>
      ) : (
        <EnergyLogTable sessions={data?.items || []} totals={data?.totals} />
      )}
    </main>
  );
}

export default function HostEnergyPage() {
  return (
    <ProtectedRoute roles={[ROLES.HOST, ROLES.ADMIN]}>
      <EnergyScreen />
    </ProtectedRoute>
  );
}
