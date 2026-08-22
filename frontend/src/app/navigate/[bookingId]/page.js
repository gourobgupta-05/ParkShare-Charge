'use client';
/**
 * TURN-BY-TURN NAVIGATION — OWNER: Maidul Islam [MI]
 * Route to the host's exact entrance after the booking is paid for.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import useTurnByTurn from '@/features/navigation/hooks/useTurnByTurn';
import RouteMap from '@/features/navigation/components/RouteMap';
import EtaBanner from '@/features/navigation/components/EtaBanner';
import TurnList from '@/features/navigation/components/TurnList';
import { getDestination, getProviderStatus } from '@/features/navigation/api/navigation.api';

function NavigateScreen() {
  const { bookingId } = useParams();
  const [meta, setMeta] = useState(null);
  const [providerInfo, setProviderInfo] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const {
    route, position, stepIndex, hasArrived,
    isStarting, error, permissionDenied, start,
  } = useTurnByTurn(bookingId);

  useEffect(() => {
    getDestination(bookingId).then(setMeta).catch((err) => setLoadError(err.message));
    getProviderStatus().then(setProviderInfo).catch(() => setProviderInfo(null));
  }, [bookingId]);

  // Start routing automatically once the first GPS fix lands.
  useEffect(() => {
    if (position && !route && !isStarting && !loadError) start();
  }, [position, route, isStarting, loadError, start]);

  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Alert tone="danger">{loadError}</Alert>
        <Link href="/bookings" className="mt-4 inline-block text-caption text-ink-brand underline">
          Back to bookings
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <Link href={`/bookings/${bookingId}`} className="text-caption text-ink-muted underline hover:text-ink">
        ← Back to booking
      </Link>

      <header className="mt-3">
        <h1 className="text-h1">Navigate to the entrance</h1>
        <p className="mt-1 text-body text-ink-muted">
          {meta?.property?.title || 'Loading your destination…'}
          {meta?.destination?.usedEntrance === false && ' · host has not pinned a gate, routing to the map pin'}
        </p>
      </header>

      {permissionDenied && (
        <Alert tone="warning" className="mt-4">
          Location permission is off. Turn it on in your browser settings, then reload this page.
        </Alert>
      )}
      {error && !permissionDenied && <Alert tone="danger" className="mt-4">{error}</Alert>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="order-2 h-[380px] lg:order-1 lg:h-[calc(100vh-240px)]">
          <RouteMap route={route} position={position} destination={meta?.destination} />
        </section>

        <aside className="order-1 flex flex-col gap-4 lg:order-2">
          {!position && !error && (
            <div className="rounded-lg border border-line bg-surface-raised p-6">
              <Spinner label="Waiting for your location" />
            </div>
          )}

          <EtaBanner route={route} hasArrived={hasArrived} isSimulated={providerInfo?.isSimulated} />

          {hasArrived ? (
            <Link href={`/bookings/${bookingId}`}>
              <Button fullWidth size="lg">Continue to check in</Button>
            </Link>
          ) : (
            route && (
              <TurnList
                steps={route.steps}
                activeIndex={stepIndex}
                entranceNote={meta?.destination?.instructions}
              />
            )
          )}

          {!route && position && (
            <Button onClick={start} isLoading={isStarting} fullWidth>
              Start navigation
            </Button>
          )}
        </aside>
      </div>
    </main>
  );
}

export default function NavigatePage() {
  return (
    <ProtectedRoute>
      <NavigateScreen />
    </ProtectedRoute>
  );
}
