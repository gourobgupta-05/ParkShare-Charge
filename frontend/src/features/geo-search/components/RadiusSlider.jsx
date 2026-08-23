'use client';
/**
 * RADIUS SLIDER — OWNER: Tamal Deb Nath [TDN]
 * 1–5 km, matching the $geoNear maxDistance the backend enforces.
 */
import { PLATFORM } from '@/lib/constants';

const MIN = PLATFORM.SEARCH_RADIUS_MIN_KM;
const MAX = PLATFORM.SEARCH_RADIUS_MAX_KM;

export default function RadiusSlider({ value, onChange, disabled }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor="radius" className="text-caption font-medium text-ink">
          Search radius
        </label>
        <span className="numeric text-caption text-ink-brand">{value} km</span>
      </div>

      <input
        id="radius"
        type="range"
        min={MIN}
        max={MAX}
        step={0.5}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-sunken accent-brand-primary disabled:opacity-50"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={value}
        aria-label={`Search radius, ${value} kilometres`}
      />

      <div className="flex justify-between text-caption text-ink-subtle">
        <span className="numeric">{MIN} km</span>
        <span className="numeric">{MAX} km</span>
      </div>
    </div>
  );
}
