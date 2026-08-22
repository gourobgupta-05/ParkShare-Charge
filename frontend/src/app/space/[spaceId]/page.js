'use client';
/**
 * SPACE DETAIL & BOOKING — composite screen
 *
 * ⚠️ SHARED SCREEN, currently assembled by Gourob Gupta [GG].
 * Four of its five panels are [GG]-owned (calendar, interval picker, tariff
 * estimator, reviews); MallHoursNotice is imported read-only from [TDN].
 * This was the missing link behind [TDN]'s "View & book" button, so the
 * booking flow was unreachable without it. When the frozen composite shell is
 * introduced, this file becomes that shell — the panels stay as they are.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Money from '@/components/ui/Money';
import { PROPERTY_TYPE } from '@/lib/constants';
import { cn } from '@/lib/formatters';
import { useAuth } from '@/context/AuthContext';

import useSlotAvailability from '@/features/calendar/hooks/useSlotAvailability';
import AvailabilityCalendar from '@/features/calendar/components/AvailabilityCalendar';
import IntervalPicker from '@/features/calendar/components/IntervalPicker';
import TariffEstimator from '@/features/tariff/components/TariffEstimator';
import ReviewList from '@/features/reviews/components/ReviewList';
import MallHoursNotice from '@/features/mall-hours/components/MallHoursNotice';
import { getPropertyDetail } from '@/features/geo-search/api/geoSearch.api';

export default function SpaceDetailPage() {
  const { spaceId } = useParams();
  const { isAuthenticated } = useAuth();

  const [property, setProperty] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [hoursBlocked, setHoursBlocked] = useState(false);

  const {
    date, setDate, day, isLoading, error,
    selectedIndexes, toggleSlot, clearSelection, selection, reload,
  } = useSlotAvailability(spaceId);

  useEffect(() => {
    if (!spaceId) return;
    getPropertyDetail(spaceId)
      .then(setProperty)
      .catch((err) => setLoadError(err.message));
  }, [spaceId]);

  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <Alert tone="danger">{loadError}</Alert>
        <Link href="/search" className="mt-4 inline-block text-caption text-ink-brand underline">
          Back to search
        </Link>
      </main>
    );
  }

  if (!property) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Loading this space" />
      </main>
    );
  }

  const isMall = property.propertyType === PROPERTY_TYPE.MALL;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link href="/search" className="text-caption text-ink-muted underline hover:text-ink">
        ← Back to search
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1">{property.title}</h1>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-caption font-medium text-white',
                isMall ? 'bg-property-mall' : 'bg-property-residential'
              )}
            >
              {isMall ? 'Mall' : 'Residential'}
            </span>
          </div>
          <p className="mt-1 text-body text-ink-muted">
            {[property.address?.line1, property.address?.area, property.address?.city].filter(Boolean).join(', ')}
          </p>
        </div>

        <div className="text-right">
          <Money poisha={property.pricePerHourPoisha} emphasis className="text-h1" />
          <p className="text-caption text-ink-muted">per hour</p>
        </div>
      </header>

      {property.hasCharger && (
        <p className="mt-3 inline-flex rounded-full bg-brand-primary-subtle px-3 py-1 text-caption font-medium text-ink-brand">
          ⚡ {property.chargerSpec?.kw ?? '—'} kW
          {property.chargerSpec?.connectorType ? ` · ${property.chargerSpec.connectorType.replace(/_/g, ' ')}` : ''}
        </p>
      )}

      <MallHoursNotice
        property={property}
        window={selection ? { startAt: selection.startAt, endAt: selection.endAt } : undefined}
        onVerdict={(v) => setHoursBlocked(v?.allowed === false)}
        className="mt-4"
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Pick your slots" subtitle="Times are Dhaka local" />
            <CardBody>
              <AvailabilityCalendar
                date={date}
                onDateChange={setDate}
                day={day}
                isLoading={isLoading}
                error={error}
                selectedIndexes={selectedIndexes}
                onToggleSlot={toggleSlot}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Reviews" />
            <CardBody>
              <ReviewList propertyId={spaceId} />
            </CardBody>
          </Card>
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <TariffEstimator propertyId={spaceId} selection={selection} />

          {isAuthenticated ? (
            <IntervalPicker
              propertyId={spaceId}
              selection={selection}
              onClear={clearSelection}
              onConflict={reload}
              mallHoursBlocked={hoursBlocked}
            />
          ) : (
            <Alert tone="info">
              <Link href="/login" className="font-medium underline">Sign in</Link> to hold a slot.
            </Alert>
          )}
        </aside>
      </div>
    </main>
  );
}
