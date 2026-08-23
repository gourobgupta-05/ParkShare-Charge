'use client';
/**
 * ADMIN — BERC TARIFFS — OWNER: Gourob Gupta [GG]
 */
import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import TariffAdminForm from '@/features/tariff/components/TariffAdminForm';
import { listRateSets } from '@/features/tariff/api/tariff.api';

function TariffAdminScreen() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setIsLoading(true);
    listRateSets()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Electricity tariffs</h1>
        <p className="mt-1 text-body text-ink-muted">
          BERC time-of-use slabs and the platform multiplier applied on top of them.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <div className="py-10"><Spinner label="Loading rate sets" /></div>
      ) : (
        <TariffAdminForm active={data?.active} multiplier={data?.tariffMultiplier} onChanged={load} />
      )}
    </main>
  );
}

export default function AdminTariffsPage() {
  return (
    <ProtectedRoute roles={[ROLES.ADMIN]}>
      <TariffAdminScreen />
    </ProtectedRoute>
  );
}
