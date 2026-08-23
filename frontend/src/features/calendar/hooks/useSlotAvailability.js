'use client';
/**
 * useSlotAvailability — OWNER: Gourob Gupta [GG]
 * Loads one day's slot grid and manages the driver's contiguous selection.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PLATFORM } from '@/lib/constants';
import { getDayAvailability } from '../api/calendar.api';

/** Today in Dhaka, as YYYY-MM-DD, regardless of the device's own timezone. */
export function dhakaToday() {
  return new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10);
}

export default function useSlotAvailability(propertyId, initialDate) {
  const [date, setDate] = useState(initialDate || dhakaToday());
  const [day, setDay] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]); // array of slot indexes

  const load = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    setError(null);
    try {
      setDay(await getDayAvailability(propertyId, date));
      setSelected([]);
    } catch (err) {
      setError(err.message);
      setDay(null);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, date]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Clicking a slot extends the selection when it stays contiguous, otherwise
   * it starts a fresh one. Contiguity matters because a booking is a single
   * window, not a set of scattered slots.
   */
  const toggleSlot = useCallback(
    (index) => {
      const slot = day?.slots?.[index];
      if (!slot?.isAvailable) return;

      setSelected((prev) => {
        if (!prev.length) return [index];
        if (prev.includes(index)) {
          // Clicking inside the range trims it back to that point.
          return prev.filter((i) => i <= index);
        }
        const min = Math.min(...prev);
        const max = Math.max(...prev);
        const next = index < min ? [index, ...prev] : [...prev, index];
        const lo = Math.min(...next);
        const hi = Math.max(...next);

        // Every slot in between must be free, or we start over.
        const span = [];
        for (let i = lo; i <= hi; i += 1) {
          if (!day.slots[i]?.isAvailable) return [index];
          span.push(i);
        }

        const maxSlots = (PLATFORM.MAX_BOOKING_HOURS * 60) / (day.slotMinutes || 30);
        if (span.length > maxSlots) return [index];

        return span;
      });
    },
    [day]
  );

  const selection = useMemo(() => {
    if (!day || !selected.length) return null;
    const lo = Math.min(...selected);
    const hi = Math.max(...selected);
    const startSlot = day.slots[lo];
    const endSlot = day.slots[hi];
    if (!startSlot || !endSlot) return null;

    const minutes = selected.length * (day.slotMinutes || 30);
    return {
      startAt: startSlot.startAt,
      endAt: endSlot.endAt,
      startLabel: startSlot.label,
      endLabel: endSlot.endLabel,
      slotCount: selected.length,
      minutes,
      hours: minutes / 60,
      meetsMinimum: minutes >= PLATFORM.MIN_BOOKING_MINUTES,
    };
  }, [day, selected]);

  return {
    date, setDate,
    day, isLoading, error, reload: load,
    selectedIndexes: selected, toggleSlot,
    clearSelection: () => setSelected([]),
    selection,
  };
}
