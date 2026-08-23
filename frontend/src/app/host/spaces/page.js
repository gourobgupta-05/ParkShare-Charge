'use client';
/**
 * HOST SPACES — OWNER: S. Moontaha Rahman [SMR]
 * Provisioning and publishing.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES, VERIFICATION_STATUS } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Money from '@/components/ui/Money';
import EmptyState from '@/components/ui/EmptyState';
import { cn } from '@/lib/formatters';
import SpaceProvisionForm from '@/features/host-verification/components/SpaceProvisionForm';
import { listMySpaces, setPublished, getMine } from '@/features/host-verification/api/hostVerification.api';

function SpacesScreen() {
  const [spaces, setSpaces] = useState([]);
  const [verification, setVerification] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setIsLoading(true);
    Promise.all([listMySpaces(), getMine()])
      .then(([spaceData, verificationData]) => {
        setSpaces(spaceData.items || []);
        setVerification(verificationData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  async function togglePublish(space) {
    setBusyId(String(space._id));
    setError(null);
    try {
      await setPublished(space._id, !space.isPublished);
      load();
    } catch (err) {
      setError(err.details ? Object.values(err.details)[0] : err.message);
    } finally {
      setBusyId(null);
    }
  }

  const isApproved = verification?.accountStatus === VERIFICATION_STATUS.APPROVED;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Your spaces</h1>
        <p className="mt-1 text-body text-ink-muted">List a bay, open its calendar, then publish it.</p>
      </div>

      {!isApproved && (
        <Alert tone="warning">
          You are not verified yet, so spaces cannot be published.{' '}
          <Link href="/host/verification" className="font-medium underline">
            Finish verification
          </Link>
        </Alert>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <div className="py-10"><Spinner label="Loading your spaces" /></div>
      ) : (
        <>
          {spaces.length ? (
            <ul className="flex flex-col gap-3">
              {spaces.map((s) => (
                <li
                  key={s._id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-surface-raised p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-h3 text-ink">{s.title}</p>
                    <p className="truncate text-caption text-ink-muted">
                      {[s.address?.area, s.address?.city].filter(Boolean).join(', ')}
                    </p>
                    <p className="mt-1 text-caption text-ink-subtle">
                      <Money poisha={s.pricePerHourPoisha} className="text-inherit" />/hr
                      {s.hasCharger && ` · ⚡ ${s.chargerSpec?.kw ?? '—'} kW`}
                    </p>
                    {!s.hasAvailability && (
                      <p className="mt-1 text-caption text-warning-fg">
                        No calendar yet —{' '}
                        <Link href="/host/availability" className="underline">open it</Link>
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-caption font-medium',
                        s.isPublished ? 'bg-brand-primary text-white' : 'bg-surface-sunken text-ink-muted'
                      )}
                    >
                      {s.isPublished ? 'live' : 'draft'}
                    </span>
                    <Button
                      size="sm"
                      variant={s.isPublished ? 'ghost' : 'outline'}
                      isLoading={busyId === String(s._id)}
                      onClick={() => togglePublish(s)}
                    >
                      {s.isPublished ? 'Unpublish' : 'Publish'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No spaces yet" description="Add your first bay below." />
          )}

          <SpaceProvisionForm onCreated={load} />
        </>
      )}
    </main>
  );
}

export default function HostSpacesPage() {
  return (
    <ProtectedRoute roles={[ROLES.HOST, ROLES.ADMIN]}>
      <SpacesScreen />
    </ProtectedRoute>
  );
}
