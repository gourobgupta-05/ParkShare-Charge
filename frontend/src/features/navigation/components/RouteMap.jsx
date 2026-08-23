'use client';
/**
 * ROUTE MAP — OWNER: Maidul Islam [MI]
 *
 * Draws the route line, the driver's live position and the entrance marker.
 *
 * Two deliberate choices:
 *  1. mapbox-gl is imported dynamically inside an effect — it touches `window`
 *     at module scope and would break server rendering otherwise.
 *  2. With no NEXT_PUBLIC_MAPBOX_TOKEN the component degrades to a readable
 *     text summary rather than a blank box, so navigation is still testable by
 *     a teammate who has no token.
 */
import { useEffect, useRef, useState } from 'react';
import { formatDistance } from '@/lib/formatters';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL || 'mapbox://styles/mapbox/streets-v12';
const MAPBOX_CSS = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css';

function ensureMapboxCss() {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`link[href="${MAPBOX_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = MAPBOX_CSS;
  document.head.appendChild(link);
}

export default function RouteMap({ route, position, destination }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const driverMarker = useRef(null);
  const [status, setStatus] = useState(TOKEN ? 'loading' : 'no-token');

  /* --------------------------------------------------------------- init -- */
  useEffect(() => {
    if (!TOKEN || !containerRef.current || mapRef.current) return undefined;
    let cancelled = false;

    (async () => {
      try {
        ensureMapboxCss();
        const mapboxgl = (await import('mapbox-gl')).default;
        if (cancelled) return;

        mapboxgl.accessToken = TOKEN;
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: STYLE,
          center: [
            destination?.lng ?? Number(process.env.NEXT_PUBLIC_DEFAULT_LNG) ?? 90.4125,
            destination?.lat ?? Number(process.env.NEXT_PUBLIC_DEFAULT_LAT) ?? 23.8103,
          ],
          zoom: 14,
        });

        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('load', () => !cancelled && setStatus('ready'));
        map.on('error', () => !cancelled && setStatus('error'));
        mapRef.current = map;
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------- route line + bounds -- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready' || !route?.geometry) return;

    const feature = { type: 'Feature', geometry: route.geometry, properties: {} };

    if (map.getSource('route')) {
      map.getSource('route').setData(feature);
    } else {
      map.addSource('route', { type: 'geojson', data: feature });
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#0F172A', // token-lint-ignore: Mapbox paint takes literals, not CSS vars
          'line-width': 9,
          'line-opacity': 0.25,
        },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#10B981', // token-lint-ignore: same reason
          'line-width': 5,
        },
      });
    }

    // Fit the whole route once, then leave the camera to the driver.
    const coords = route.geometry.coordinates || [];
    if (coords.length > 1) {
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 56, duration: 700, maxZoom: 16 }
      );
    }
  }, [route, status]);

  /* --------------------------------------------------- entrance marker --- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready' || !destination) return;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      const el = document.createElement('div');
      el.className =
        'flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-brand-secondary text-white shadow-2';
      el.textContent = '◉';
      el.setAttribute('aria-label', 'Parking entrance');

      new mapboxgl.Marker({ element: el })
        .setLngLat([destination.lng, destination.lat])
        .setPopup(new mapboxgl.Popup({ offset: 16, closeButton: false }).setText('Parking entrance'))
        .addTo(map);
    })();
  }, [destination, status]);

  /* ------------------------------------------------------ driver marker -- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready' || !position) return;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;

      if (!driverMarker.current) {
        const el = document.createElement('div');
        el.className =
          'h-4 w-4 rounded-full border-2 border-surface bg-brand-primary shadow-glow-charge animate-charge-pulse';
        el.setAttribute('aria-label', 'Your position');
        driverMarker.current = new mapboxgl.Marker({ element: el })
          .setLngLat([position.lng, position.lat])
          .addTo(map);
      } else {
        driverMarker.current.setLngLat([position.lng, position.lat]);
      }
    })();
  }, [position, status]);

  /* -------------------------------------------------------------- render -- */
  if (status === 'no-token' || status === 'error') {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface-sunken p-6 text-center">
        <p className="text-h3 text-ink">
          {status === 'no-token' ? 'Map needs a Mapbox token' : 'The map could not load'}
        </p>
        <p className="max-w-sm text-caption text-ink-muted">
          {status === 'no-token'
            ? 'Add NEXT_PUBLIC_MAPBOX_TOKEN to frontend/.env.local to see the route drawn. Turn-by-turn directions below still work.'
            : 'Check the token is valid for this domain. Directions below are unaffected.'}
        </p>
        {route && (
          <p className="numeric text-caption text-ink-subtle">
            {formatDistance(route.distanceMeters || 0)} · {Math.round((route.etaSeconds || 0) / 60)} min
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[280px] overflow-hidden rounded-lg border border-line">
      <div ref={containerRef} className="h-full w-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-sunken">
          <span className="text-caption text-ink-muted">Loading map…</span>
        </div>
      )}
    </div>
  );
}
