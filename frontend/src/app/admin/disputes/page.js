'use client';
/**
 * ADMIN — ESCROW & DISPUTES — OWNER: Tamal Deb Nath [TDN]
 */
import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import Money from '@/components/ui/Money';
import Card, { CardBody } from '@/components/ui/Card';
import DisputeTable from '@/features/escrow/components/DisputeTable';
import { listHolds } from '@/features/escrow/api/escrow.api';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'HELD', label: 'Held' },
  { value: 'RELEASED', label: 'Released' },
  { value: 'REFUNDED', label: 'Refunded' },
];

function DisputesScreen() {
  const [status, setStatus] = useState('HELD');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    listHolds(status ? { status } : {})
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [status]);

  useEffect(load, [load]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Escrow &amp; disputes</h1>
        <p className="mt-1 text-body text-ink-muted">
          Every hold on the platform. Refunds append a reversing ledger entry — nothing is edited.
        </p>
      </div>

      {data?.byStatus?.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {data.byStatus.map((row) => (
            <Card key={row._id}>
              <CardBody>
                <p className="text-overline uppercase text-ink-muted">{row._id.replace(/_/g, ' ')}</p>
                <p className="mt-1 font-display text-h1 text-ink">
                  <Money poisha={row.amountPoisha} />
                </p>
                <p className="numeric text-caption text-ink-muted">{row.count} hold{row.count === 1 ? '' : 's'}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
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
        <div className="py-10"><Spinner label="Loading escrow holds" /></div>
      ) : (
        <DisputeTable holds={data?.items || []} onChanged={load} />
      )}
    </main>
  );
}

export default function AdminDisputesPage() {
  return (
    <ProtectedRoute roles={[ROLES.ADMIN]}>
      <DisputesScreen />
    </ProtectedRoute>
  );
}
