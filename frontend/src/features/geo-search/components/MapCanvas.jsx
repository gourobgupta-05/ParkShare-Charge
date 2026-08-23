'use client';
/**
 * MAP CANVAS — OWNER: Tamal Deb Nath [TDN]
 *
 * Renders active slots as pins on Mapbox GL. Two things worth knowing:
 *
 *  1. The token comes from NEXT_PUBLIC_MAPBOX_TOKEN. If it's missing, the
 *     component degrades to a labelled placeholder instead of crashing — the
 *     rest of the search page (list, filters, booking) keeps working, so a
 *     teammate without a token can still run the app.
 *  2. mapbox-gl is imported dynamically inside an effect because it touches
 *     `window` at module scope and would break server-side rendering.
 *
 * Marker colours use design tokens via CSS classes, never inline hex.
 */
import { useEffect, useRef, useState } from 'react';
import { PROPERTY_TYPE, PLATFORM } from '@/lib/constants';
import { formatMoney, formatDistance, cn } from '@/lib/formatters';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL || 'mapbox://styles/mapbox/streets-v12';
const MAPBOX_CSS = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css';

/** Injects the Mapbox stylesheet once, so no build-time CSS import is needed. */
function ensureMapboxCss() {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`link[href="${MAPBOX_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = MAPBOX_CSS;
  document.head.appendChild(link);
}

/** Builds a marker element out of Tailwind tokens. */
function buildMarkerEl(property, isSelected) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = cn(
    'flex items-center gap-1 rounded-full border-2 border-surface px-2 py-1 shadow-2',
    'text-caption font-medium text-white transition-transform duration-fast hover:scale-105',
    property.propertyType === PROPERTY_TYPE.MALL ? 'bg-property-mall' : 'bg-property-residential',
    isSelected && 'scale-110 ring-2 ring-brand-primary ring-offset-2'
  );
  el.textContent = formatMoney(property.pricePerHourPoisha, { withSymbol: true });
  el.setAttribute('aria-label', `${property.title}, ${formatMoney(property.pricePerHourPoisha)} per hour`);
  return el;
}

export default function MapCanvas({ centre, results = [], selectedId, onSelect, radiusKm }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [status, setStatus] = useState(TOKEN ? 'loading' : 'no-token');

  /* ------------------------------------------------------------ init map */
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
          center: [centre?.lng ?? PLATFORM.DHAKA_CENTER.lng, centre?.lat ?? PLATFORM.DHAKA_CENTER.lat],
          zoom: Number(process.env.NEXT_PUBLIC_DEFAULT_ZOOM) || 13,
          attributionControl: true,
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

  /* ------------------------------------------------- recentre + radius ring */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready' || !centre) return;

    map.easeTo({ center: [centre.lng, centre.lat], duration: 600 });

    const ring = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [centre.lng, centre.lat] },
      properties: {},
    };

    if (map.getSource('search-centre')) {
      map.getSource('search-centre').setData(ring);
    } else {
      map.addSource('search-centre', { type: 'geojson', data: ring });
      map.addLayer({
        id: 'search-radius',
        type: 'circle',
        source: 'search-centre',
        paint: {
          // Radius is metres-to-pixels at the current zoom; approximated with a
          // zoom-interpolated pixel radius, which is accurate enough for a
          // visual "how far am I searching" cue.
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 10, 8, 16, 320],
          'circle-color': '#10B981', // token-lint-ignore: Mapbox paint props take literals, not CSS vars
          'circle-opacity': 0.08,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#10B981', // token-lint-ignore: same reason
          'circle-stroke-opacity': 0.4,
        },
      });
    }
  }, [centre, radiusKm, status]);

  /* --------------------------------------------------------- draw markers */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      results.forEach((property) => {
        if (!Number.isFinite(property.lng) || !Number.isFinite(property.lat)) return;

        const el = buildMarkerEl(property, String(property._id) === String(selectedId));
        el.addEventListener('click', () => onSelect?.(property));

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([property.lng, property.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 18, closeButton: false }).setHTML(
              `<div style="font-family:inherit">
                 <strong>${property.title.replace(/</g, '&lt;')}</strong><br/>
                 ${formatMoney(property.pricePerHourPoisha)}/hr · ${formatDistance(property.distanceMeters || 0)}
               </div>`
            )
          )
          .addTo(map);

        markersRef.current.push(marker);
      });
    })();
  }, [results, selectedId, onSelect, status]);

  /* --------------------------------------------------------------- render */
  if (status === 'no-token' || status === 'error') {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface-sunken p-6 text-center">
        <p className="text-h3 text-ink">
          {status === 'no-token' ? 'Map needs a Mapbox token' : 'The map could not load'}
        </p>
        <p className="max-w-sm text-caption text-ink-muted">
          {status === 'no-token'
            ? 'Add NEXT_PUBLIC_MAPBOX_TOKEN to frontend/.env.local to see pins. Search results below still work without it.'
            : 'Check the token is valid and allowed for this domain. The result list below is unaffected.'}
        </p>
        <p className="numeric text-caption text-ink-subtle">
          {results.length} space{results.length === 1 ? '' : 's'} found nearby
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-lg border border-line">
      <div ref={containerRef} className="h-full w-full" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-sunken">
          <span className="text-caption text-ink-muted">Loading map…</span>
        </div>
      )}
    </div>
  );
}
