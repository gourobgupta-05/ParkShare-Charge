'use client';
/**
 * useGeoSearch — OWNER: Tamal Deb Nath [TDN]
 * Owns the search filter state and talks to /api/geo/search.
 * Debounced so dragging the radius slider doesn't fire a request per pixel.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PLATFORM } from '@/lib/constants';
import { searchNearby } from '../api/geoSearch.api';

const DEFAULT_RADIUS = Number(process.env.NEXT_PUBLIC_SEARCH_RADIUS_DEFAULT_KM) || 3;

export default function useGeoSearch(coords) {
  const [filters, setFilters] = useState({
    radiusKm: Math.min(Math.max(DEFAULT_RADIUS, PLATFORM.SEARCH_RADIUS_MIN_KM), PLATFORM.SEARCH_RADIUS_MAX_KM),
    propertyType: 'ALL',
    hasCharger: undefined,
    connectorType: undefined,
    maxPricePoisha: undefined,
    sort: 'distance',
    startAt: undefined,
    endAt: undefined,
  });

  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const run = useCallback(async () => {
    if (!coords?.lat || !coords?.lng) return;
    const id = ++requestId.current;

    setIsLoading(true);
    setError(null);
    try {
      const data = await searchNearby({ lat: coords.lat, lng: coords.lng, ...filters });
      if (id !== requestId.current) return; // a newer request already won
      setResults(data.results || []);
      setSummary(data.summary || null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err.message);
      setResults([]);
      setSummary(null);
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [coords?.lat, coords?.lng, filters]);

  useEffect(() => {
    const timer = setTimeout(run, 300);
    return () => clearTimeout(timer);
  }, [run]);

  const updateFilter = useCallback((patch) => setFilters((f) => ({ ...f, ...patch })), []);

  const resetFilters = useCallback(
    () =>
      setFilters((f) => ({
        ...f,
        propertyType: 'ALL',
        hasCharger: undefined,
        connectorType: undefined,
        maxPricePoisha: undefined,
        sort: 'distance',
      })),
    []
  );

  return { filters, updateFilter, resetFilters, results, summary, isLoading, error, refetch: run };
}
