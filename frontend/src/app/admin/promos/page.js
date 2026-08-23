'use client';
/**
 * ADMIN — PROMO CODES — OWNER: Maidul Islam [MI]
 */
import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import PromoAdminTable from '@/features/promo/components/PromoAdminTable';
import { listAllCodes } from '@/features/promo/api/promo.api';

function PromoAdminScreen() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setIsLoading(true);
    listAllCodes()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Promo codes</h1>
        <p className="mt-1 text-body text-ink-muted">
          Commercial partner campaigns. Discounts are flat amounts applied before VAT.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <div className="py-10"><Spinner label="Loading promo codes" /></div>
      ) : (
        <PromoAdminTable codes={data?.items || []} onChanged={load} />
      )}
    </main>
  );
}

export default function AdminPromosPage() {
  return (
    <ProtectedRoute roles={[ROLES.ADMIN]}>
      <PromoAdminScreen />
    </ProtectedRoute>
  );
}
