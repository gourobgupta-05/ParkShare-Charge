'use client';
/**
 * FILTER BAR — OWNER: Tamal Deb Nath [TDN]
 * Charger, connector, price ceiling and sort. Options are fetched from
 * /api/filter/options so nothing is hardcoded against the seed data.
 */
import { useEffect, useState } from 'react';
import { formatMoney, cn } from '@/lib/formatters';
import { getFilterOptions } from '../api/propertyFilter.api';

const SORTS = [
  { value: 'distance', label: 'Nearest' },
  { value: 'price_asc', label: 'Cheapest' },
  { value: 'price_desc', label: 'Priciest' },
  { value: 'rating', label: 'Top rated' },
];

export default function FilterBar({ filters, onChange, onReset }) {
  const [options, setOptions] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getFilterOptions()
      .then((data) => !cancelled && setOptions(data))
      .catch(() => !cancelled && setOptions(null)); // filters degrade, page still works
    return () => {
      cancelled = true;
    };
  }, []);

  const hasActiveFilters =
    filters.hasCharger !== undefined ||
    filters.connectorType !== undefined ||
    filters.maxPricePoisha !== undefined ||
    filters.sort !== 'distance';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ hasCharger: filters.hasCharger ? undefined : true })}
          className={cn(
            'rounded-full border px-3 py-1.5 text-caption font-medium transition-colors duration-fast',
            filters.hasCharger
              ? 'border-brand-primary bg-brand-primary-subtle text-ink-brand'
              : 'border-line text-ink-muted hover:border-line-strong'
          )}
        >
          ⚡ EV charging
        </button>

        {options?.connectorTypes?.length > 0 && (
          <select
            aria-label="Connector type"
            value={filters.connectorType || ''}
            onChange={(e) => onChange({ connectorType: e.target.value || undefined })}
            className="h-8 rounded border border-line bg-surface px-2 text-caption text-ink"
          >
            <option value="">Any connector</option>
            {options.connectorTypes.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        )}

        <select
          aria-label="Sort results"
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value })}
          className="h-8 rounded border border-line bg-surface px-2 text-caption text-ink"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="text-caption font-medium text-ink-muted underline hover:text-ink"
          >
            Clear filters
          </button>
        )}
      </div>

      {options?.priceRangePoisha?.max > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <label htmlFor="maxPrice" className="text-caption font-medium text-ink">
              Max price per hour
            </label>
            <span className="numeric text-caption text-ink-brand">
              {filters.maxPricePoisha ? formatMoney(filters.maxPricePoisha) : 'Any'}
            </span>
          </div>
          <input
            id="maxPrice"
            type="range"
            min={options.priceRangePoisha.min}
            max={options.priceRangePoisha.max}
            step={500}
            value={filters.maxPricePoisha ?? options.priceRangePoisha.max}
            onChange={(e) => {
              const next = Number(e.target.value);
              onChange({ maxPricePoisha: next >= options.priceRangePoisha.max ? undefined : next });
            }}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-sunken accent-brand-primary"
          />
        </div>
      )}
    </div>
  );
}
