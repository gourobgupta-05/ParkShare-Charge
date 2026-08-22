'use client';
/**
 * PROPERTY CATEGORY TOGGLE — OWNER: Tamal Deb Nath [TDN]
 * Residential vs Commercial Mall. The value maps straight to the backend
 * string match (propertyType: "MALL").
 *
 * Counts are optional — when supplied they render as badges so the driver can
 * see there's no point switching to a category with nothing in it.
 */
import { PROPERTY_TYPE } from '@/lib/constants';
import { cn } from '@/lib/formatters';

const OPTIONS = [
  { value: 'ALL', label: 'All', countKey: 'all' },
  { value: PROPERTY_TYPE.RESIDENTIAL, label: 'Residential', countKey: 'residential' },
  { value: PROPERTY_TYPE.MALL, label: 'Mall', countKey: 'mall' },
];

export default function PropertyTypeToggle({ value = 'ALL', onChange, counts, disabled }) {
  return (
    <div
      role="radiogroup"
      aria-label="Property category"
      className="inline-flex w-full rounded-lg border border-line bg-surface-sunken p-1"
    >
      {OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        const count = counts?.[opt.countKey]?.count;

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange?.(opt.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2',
              'text-caption font-medium transition-colors duration-fast disabled:opacity-50',
              isActive
                ? opt.value === PROPERTY_TYPE.MALL
                  ? 'bg-property-mall text-white shadow-1'
                  : 'bg-brand-primary text-white shadow-1'
                : 'text-ink-muted hover:text-ink'
            )}
          >
            {opt.label}
            {Number.isFinite(count) && (
              <span
                className={cn(
                  'numeric rounded-full px-1.5 text-caption',
                  isActive ? 'bg-white/20' : 'bg-surface text-ink-subtle'
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
