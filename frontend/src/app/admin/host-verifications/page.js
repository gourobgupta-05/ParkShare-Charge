'use client';
/**
 * ADMIN — HOST VERIFICATIONS — OWNER: S. Moontaha Rahman [SMR]
 */
import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES, VERIFICATION_STATUS } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import AdminAuditTable from '@/features/host-verification/components/AdminAuditTable';
import { adminQueue } from '@/features/host-verification/api/hostVerification.api';

const FILTERS = [
  { value: '', label: 'Awaiting review' },
  { value: VERIFICATION_STATUS.APPROVED, label: 'Approved' },
  { value: VERIFICATION_STATUS.REJECTED, label: 'Rejected' },
  { value: VERIFICATION_STATUS.DRAFT, label: 'Drafts' },
];

function QueueScreen() {
  const [status, setStatus] = useState('');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setError(null);
    adminQueue(status ? { status } : {})
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [status]);

  useEffect(load, [load]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Host verifications</h1>
        <p className="mt-1 text-body text-ink-muted">
          Nothing a host lists becomes bookable until it is approved here.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'queue'}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`rounded-full border px-3 py-1.5 text-caption font-medium transition-colors duration-fast ${
              status === f.value
                ? 'border-brand-primary bg-brand-primary-subtle text-ink-brand'
                : 'border-line text-ink-muted hover:border-line-strong'
            }`}
          >
            {f.label}
            {f.value && data?.counts?.[f.value] ? ` (${data.counts[f.value]})` : ''}
          </button>
        ))}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <div className="py-10"><Spinner label="Loading the queue" /></div>
      ) : (
        <AdminAuditTable submissions={data?.items || []} onChanged={load} />
      )}
    </main>
  );
}

export default function AdminVerificationsPage() {
  return (
    <ProtectedRoute roles={[ROLES.ADMIN]}>
      <QueueScreen />
    </ProtectedRoute>
  );
}
