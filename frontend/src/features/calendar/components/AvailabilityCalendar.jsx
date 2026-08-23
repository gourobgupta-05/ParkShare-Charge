'use client';
/**
 * AVAILABILITY CALENDAR — OWNER: Gourob Gupta [GG]
 * Day picker plus the slot grid. Slots the driver selects turn mint; booked
 * and past slots are visibly dead rather than merely disabled, so the reason
 * is readable without a tooltip.
 */
import { PLATFORM } from '@/lib/constants';
import { cn } from '@/lib/formatters';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import { dhakaToday } from '../hooks/useSlotAvailability';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Next 14 Dhaka days as { value, weekday, dayNum }. */
function upcomingDays(count = 14) {
  const out = [];
  const base = new Date(Date.now() + 6 * 3600000);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base.getTime() + i * 86400000);
    out.push({
      value: d.toISOString().slice(0, 10),
      weekday: DAY_LABELS[d.getUTCDay()],
      dayNum: d.getUTCDate(),
    });
  }
  return out;
}

export default function AvailabilityCalendar({
  date, onDateChange, day, isLoading, error, selectedIndexes = [], onToggleSlot,
}) {
  const days = upcomingDays();

  return (
    <div className="flex flex-col gap-4">
      {/* date strip */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Choose a date">
        {days.map((d) => {
          const active = d.value === date;
          return (
            <button
              key={d.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onDateChange(d.value)}
              className={cn(
                'flex min-w-[56px] shrink-0 flex-col items-center rounded-lg border px-2 py-2 transition-colors duration-fast',
                active
                  ? 'border-brand-primary bg-brand-primary text-white'
                  : 'border-line bg-surface text-ink-muted hover:border-line-strong'
              )}
            >
              <span className="text-caption">{d.weekday}</span>
              <span className={cn('numeric text-h3', active ? 'text-white' : 'text-ink')}>{d.dayNum}</span>
            </button>
          );
        })}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading && (
        <div className="py-8">
          <Spinner label="Loading availability" />
        </div>
      )}

      {!isLoading && day && !day.hasRules && (
        <EmptyState
          title="Calendar not open yet"
          description="This host has not published availability for this space. Try another space or check back later."
        />
      )}

      {!isLoading && day?.isBlackout && (
        <Alert tone="warning">The host has blocked this date.</Alert>
      )}

      {!isLoading && day?.hasRules && !day.isBlackout && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-caption text-ink-muted">
              <span className="numeric font-medium text-ink">{day.summary.available}</span> of{' '}
              <span className="numeric">{day.summary.total}</span> slots free ·{' '}
              {day.slotMinutes}-minute steps
            </p>
            <p className="text-caption text-ink-subtle">
              Minimum {PLATFORM.MIN_BOOKING_MINUTES} min
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {day.slots.map((slot, index) => {
              const isSelected = selectedIndexes.includes(index);
              return (
                <button
                  key={slot.startAt}
                  type="button"
                  disabled={!slot.isAvailable}
                  onClick={() => onToggleSlot(index)}
                  aria-pressed={isSelected}
                  title={slot.reason ? slot.reason.toLowerCase() : 'available'}
                  className={cn(
                    'numeric rounded border px-2 py-2 text-caption transition-colors duration-fast',
                    isSelected && 'border-brand-primary bg-brand-primary text-white',
                    !isSelected && slot.isAvailable && 'border-line bg-surface text-ink hover:border-brand-primary',
                    !slot.isAvailable && slot.reason === 'BOOKED' && 'cursor-not-allowed border-line bg-surface-sunken text-ink-subtle line-through',
                    !slot.isAvailable && slot.reason !== 'BOOKED' && 'cursor-not-allowed border-line bg-surface-sunken text-ink-subtle'
                  )}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 text-caption text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border border-line bg-surface" /> Free
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-brand-primary" /> Selected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-surface-sunken" /> Taken or past
            </span>
          </div>
        </>
      )}
    </div>
  );
}
