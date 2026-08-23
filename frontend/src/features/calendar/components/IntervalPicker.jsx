'use client';
/**
 * INTERVAL PICKER — OWNER: Gourob Gupta [GG]
 * Confirms the selected window and creates the booking. On a slot collision it
 * says so plainly and reloads the grid, because the honest failure here is
 * "someone beat you to it", not a generic error.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ERROR_CODES, PLATFORM } from '@/lib/constants';
import { formatDuration } from '@/lib/formatters';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { createBooking } from '../api/calendar.api';

export default function IntervalPicker({ propertyId, selection, onClear, onConflict, mallHoursBlocked }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!selection) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface-sunken px-4 py-3 text-caption text-ink-muted">
        Pick one or more slots above to build your booking window.
      </p>
    );
  }

  async function book() {
    setBusy(true);
    setError(null);
    try {
      const data = await createBooking({
        propertyId,
        startAt: selection.startAt,
        endAt: selection.endAt,
      });
      router.push(`/bookings/${data.booking._id}`);
    } catch (err) {
      setError(err.message);
      if (err.code === ERROR_CODES.SLOT_ALREADY_BOOKED) onConflict?.();
    } finally {
      setBusy(false);
    }
  }

  const tooShort = !selection.meetsMinimum;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="numeric text-h3 text-ink">
            {selection.startLabel} – {selection.endLabel}
          </p>
          <p className="text-caption text-ink-muted">
            {formatDuration(selection.minutes)} · {selection.slotCount} slot
            {selection.slotCount === 1 ? '' : 's'}
          </p>
        </div>
        <button type="button" onClick={onClear} className="text-caption text-ink-muted underline hover:text-ink">
          Clear
        </button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {tooShort && (
        <Alert tone="warning">
          Bookings run for at least {PLATFORM.MIN_BOOKING_MINUTES} minutes. Select another slot.
        </Alert>
      )}

      <Button
        onClick={book}
        isLoading={busy}
        disabled={tooShort || mallHoursBlocked}
        fullWidth
        size="lg"
      >
        Hold this slot
      </Button>

      <p className="text-caption text-ink-subtle">
        The slot is held for 10 minutes while you pay. Unpaid holds are released automatically.
      </p>
    </div>
  );
}
