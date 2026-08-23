'use client';
/**
 * MALL HOURS NOTICE — OWNER: Tamal Deb Nath [TDN]
 * Inline closing-time warning. Renders nothing for residential spaces or
 * 24/7 malls, so it can be dropped into any card without a guard.
 *
 * Pass `window` ({ startAt, endAt }) to get a live verdict from the backend
 * guard; omit it to just display the opening hours.
 */
import { useEffect, useState } from 'react';
import { PROPERTY_TYPE } from '@/lib/constants';
import { cn } from '@/lib/formatters';
import { checkWindow } from '../api/mallHours.api';

const label = (minutes) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export default function MallHoursNotice({ property, window: bookingWindow, className, onVerdict }) {
  const [verdict, setVerdict] = useState(null);
  const hours = property?.operatingHours;
  const applies = property?.propertyType === PROPERTY_TYPE.MALL && hours && !hours.is24x7;

  useEffect(() => {
    if (!applies || !bookingWindow?.startAt || !bookingWindow?.endAt || !property?._id) {
      setVerdict(null);
      return undefined;
    }
    let cancelled = false;

    checkWindow({
      propertyId: property._id,
      startAt: bookingWindow.startAt,
      endAt: bookingWindow.endAt,
    })
      .then((data) => {
        if (cancelled) return;
        setVerdict(data);
        onVerdict?.(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const failed = { allowed: false, reason: err.message };
        setVerdict(failed);
        onVerdict?.(failed);
      });

    return () => {
      cancelled = true;
    };
  }, [applies, bookingWindow?.startAt, bookingWindow?.endAt, property?._id, onVerdict]);

  if (!applies) return null;

  const blocked = verdict && verdict.allowed === false;

  return (
    <div
      className={cn(
        'rounded border px-3 py-2 text-caption',
        blocked ? 'border-danger/30 bg-danger-subtle text-danger-fg' : 'border-warning/30 bg-warning-subtle text-warning-fg',
        className
      )}
      role={blocked ? 'alert' : undefined}
    >
      <span className="font-medium">
        {blocked ? 'Outside opening hours' : 'Mall hours apply'}
      </span>{' '}
      <span className="numeric">
        {label(hours.openMinute ?? 0)} – {label(hours.closeMinute ?? 1440)}
      </span>
      {blocked && verdict.reason && <p className="mt-1">{verdict.reason}</p>}
      {blocked && verdict.suggestion?.closesAt && (
        <p className="mt-1">
          Latest possible end today: <span className="numeric">{verdict.suggestion.closesAt}</span>
        </p>
      )}
    </div>
  );
}
