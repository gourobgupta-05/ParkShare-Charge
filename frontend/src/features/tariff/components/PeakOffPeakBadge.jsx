'use client';
/**
 * PEAK / OFF-PEAK BADGE — OWNER: Gourob Gupta [GG]
 * Uses the tariff domain tokens so the period colour means the same thing
 * everywhere in the app.
 */
import { cn } from '@/lib/formatters';

const STYLES = {
  PEAK: { className: 'bg-tariff-peak text-white', label: 'Peak' },
  STANDARD: { className: 'bg-tariff-standard text-white', label: 'Standard' },
  OFF_PEAK: { className: 'bg-tariff-offpeak text-white', label: 'Off-peak' },
};

export default function PeakOffPeakBadge({ period, className }) {
  const style = STYLES[period] || STYLES.STANDARD;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium',
        style.className,
        className
      )}
    >
      {style.label}
    </span>
  );
}
