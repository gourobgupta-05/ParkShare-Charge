'use client';
/**
 * SEARCH — OWNER: Tamal Deb Nath [TDN]
 * Map dashboard: live coordinates, 1–5 km radius, category toggle, pinned
 * active slots. Every component on this page is [TDN]-owned, so this page is
 * safe to own outright rather than being a shared composite shell.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import useUserLocation from '@/features/geo-search/hooks/useUserLocation';
import useGeoSearch from '@/features/geo-search/hooks/useGeoSearch';
import MapCanvas from '@/features/geo-search/components/MapCanvas';
import RadiusSlider from '@/features/geo-search/components/RadiusSlider';
import ResultList from '@/features/geo-search/components/ResultList';
import PropertyTypeToggle from '@/features/property-filter/components/PropertyTypeToggle';
import FilterBar from '@/features/property-filter/components/FilterBar';
import { getCategoryCounts } from '@/features/property-filter/api/propertyFilter.api';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { PLATFORM } from '@/lib/constants';

export default function SearchPage() {
  const { coords, isPrecise, isLocating, error: locationError, locate } = useUserLocation();
  const { filters, updateFilter, resetFilters, results, summary, isLoading, error } = useGeoSearch(coords);
  const [selectedId, setSelectedId] = useState(null);
  const [counts, setCounts] = useState(null);

  // Category badge counts, scoped to the same radius as the map.
  useEffect(() => {
    let cancelled = false;
    getCategoryCounts({ lat: coords.lat, lng: coords.lng, radiusKm: filters.radiusKm })
      .then((data) => !cancelled && setCounts(data))
      .catch(() => !cancelled && setCounts(null));
    return () => {
      cancelled = true;
    };
  }, [coords.lat, coords.lng, filters.radiusKm]);

  const select = useCallback((property) => setSelectedId(property?._id ?? null), []);
  const widen = useCallback(
    () => updateFilter({ radiusKm: PLATFORM.SEARCH_RADIUS_MAX_KM, propertyType: 'ALL', hasCharger: undefined }),
    [updateFilter]
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1">Find parking</h1>
          <p className="mt-1 text-body text-ink-muted">
            {isPrecise ? 'Showing spaces near your location' : 'Showing spaces in central Dhaka'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={locate} isLoading={isLocating}>
            Use my location
          </Button>
          <Link href="/wallet">
            <Button variant="ghost" size="sm">Wallet</Button>
          </Link>
        </div>
      </header>

      {locationError && <Alert tone="warning" className="mt-4">{locationError}</Alert>}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* map column */}
        <section className="order-2 h-[420px] lg:order-1 lg:h-[calc(100vh-220px)] lg:sticky lg:top-6">
          <MapCanvas
            centre={coords}
            results={results}
            selectedId={selectedId}
            onSelect={select}
            radiusKm={filters.radiusKm}
          />
        </section>

        {/* filters + results column */}
        <section className="order-1 flex flex-col gap-4 lg:order-2">
          <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface-raised p-4">
            <PropertyTypeToggle
              value={filters.propertyType}
              onChange={(v) => updateFilter({ propertyType: v })}
              counts={counts}
            />
            <RadiusSlider value={filters.radiusKm} onChange={(v) => updateFilter({ radiusKm: v })} />
            <FilterBar filters={filters} onChange={updateFilter} onReset={resetFilters} />
          </div>

          <ResultList
            results={results}
            summary={summary}
            isLoading={isLoading}
            error={error}
            selectedId={selectedId}
            onSelect={select}
            onWiden={widen}
          />
        </section>
      </div>
    </main>
  );
}
