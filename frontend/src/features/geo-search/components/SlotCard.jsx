'use client';
/**
 * SLOT CARD — OWNER: Tamal Deb Nath [TDN]
 * One search result. Shows the mall-hours notice inline so a driver sees the
 * closing-time constraint before they open the booking screen.
 */
import Link from 'next/link';
import { PROPERTY_TYPE } from '@/lib/constants';
import { formatMoney, formatDistance, cn } from '@/lib/formatters';
import Money from '@/components/ui/Money';
import MallHoursNotice from '@/features/mall-hours/components/MallHoursNotice';

export default function SlotCard({ property, isSelected, onSelect }) {
  const isMall = property.propertyType === PROPERTY_TYPE.MALL;

  return (
    <article
      onClick={() => onSelect?.(property)}
      className={cn(
        'cursor-pointer rounded-lg border bg-surface-raised p-4 transition-colors duration-fast',
        isSelected ? 'border-brand-primary shadow-glow-charge' : 'border-line hover:border-line-strong'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-h3 text-ink">{property.title}</h3>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-caption font-medium text-white',
                isMall ? 'bg-property-mall' : 'bg-property-residential'
              )}
            >
              {isMall ? 'Mall' : 'Residential'}
            </span>
          </div>

          <p className="mt-1 truncate text-caption text-ink-muted">
            {property.address?.area || property.address?.line1 || 'Dhaka'}
            {Number.isFinite(property.distanceMeters) && (
              <span className="numeric"> · {formatDistance(property.distanceMeters)} away</span>
            )}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <Money poisha={property.pricePerHourPoisha} emphasis />
          <span className="block text-caption text-ink-muted">per hour</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {property.hasCharger ? (
          <span className="rounded-full bg-brand-primary-subtle px-2 py-0.5 text-caption font-medium text-ink-brand">
            ⚡ {property.chargerSpec?.kw ?? '—'} kW
            {property.chargerSpec?.connectorType ? ` · ${property.chargerSpec.connectorType.replace(/_/g, ' ')}` : ''}
          </span>
        ) : (
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-caption text-ink-muted">
            Parking only
          </span>
        )}

        {property.avgRating > 0 && (
          <span className="numeric text-caption text-ink-muted">
            ★ {property.avgRating.toFixed(1)} ({property.ratingCount})
          </span>
        )}

        {(property.amenities || []).slice(0, 2).map((a) => (
          <span key={a} className="rounded-full bg-surface-sunken px-2 py-0.5 text-caption text-ink-muted">
            {a.replace(/_/g, ' ').toLowerCase()}
          </span>
        ))}
      </div>

      <MallHoursNotice property={property} className="mt-3" />

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <span className="text-caption text-ink-subtle">
          {property.totalSlots > 1 ? `${property.totalSlots} bays` : 'Single slot'}
        </span>
        <Link
          href={`/space/${property._id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-caption font-medium text-ink-brand underline"
        >
          View &amp; book
        </Link>
      </div>
    </article>
  );
}
