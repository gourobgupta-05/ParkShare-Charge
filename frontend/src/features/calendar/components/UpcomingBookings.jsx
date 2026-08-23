'use client';
/**
 * UPCOMING BOOKINGS — OWNER: Gourob Gupta [GG]
 * Drops into the driver's bookings list or the host dashboard; the `scope`
 * prop switches which side of the booking is shown.
 */
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import Money from '@/components/ui/Money';
import EmptyState from '@/components/ui/EmptyState';
import { formatDateTime, formatDuration } from '@/lib/formatters';

export default function UpcomingBookings({ bookings = [], scope = 'driver', emptyAction }) {
  if (!bookings.length) {
    return (
      <EmptyState
        title={scope === 'host' ? 'No bookings yet' : 'No bookings yet'}
        description={
          scope === 'host'
            ? 'Once drivers book your space, their sessions appear here.'
            : 'Find a space near you and your bookings will show up here.'
        }
        action={emptyAction}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {bookings.map((b) => {
        const minutes = Math.round((new Date(b.endAt) - new Date(b.startAt)) / 60000);
        const counterparty = scope === 'host' ? b.driverId : b.hostId;

        return (
          <li key={b._id}>
            <Link
              href={`/bookings/${b._id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface-raised p-4 transition-colors duration-fast hover:border-line-strong"
            >
              <div className="min-w-0">
                <p className="truncate text-h3 text-ink">{b.propertyId?.title || 'Space'}</p>
                <p className="numeric mt-0.5 text-caption text-ink-muted">
                  {formatDateTime(b.startAt)} · {formatDuration(minutes)}
                </p>
                <p className="mt-0.5 truncate text-caption text-ink-subtle">
                  {counterparty?.businessName || counterparty?.name || ''}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <StatusBadge status={b.status} />
                {b.pricing?.totalPoisha > 0 && <Money poisha={b.pricing.totalPoisha} />}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
