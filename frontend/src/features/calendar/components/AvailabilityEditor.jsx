'use client';
/**
 * AVAILABILITY EDITOR — OWNER: Gourob Gupta [GG]
 * Host-side weekly rules and blackout dates. Rules are stored in the embedded
 * array on the property, which is what the slot grid reads.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { cn } from '@/lib/formatters';
import { setAvailability } from '../api/calendar.api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toLabel = (minutes) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export default function AvailabilityEditor({ property, onSaved }) {
  const [rules, setRules] = useState(
    (property.availability || []).map((r) => ({
      dayOfWeek: r.dayOfWeek,
      start: toLabel(r.startMinute),
      end: toLabel(r.endMinute),
    }))
  );
  const [blackouts, setBlackouts] = useState(
    (property.blackoutDates || []).map((d) => new Date(d).toISOString().slice(0, 10))
  );
  const [newBlackout, setNewBlackout] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const addRule = (dayOfWeek) =>
    setRules((r) => [...r, { dayOfWeek, start: '08:00', end: '20:00' }]);

  const updateRule = (index, patch) =>
    setRules((r) => r.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));

  const removeRule = (index) => setRules((r) => r.filter((_, i) => i !== index));

  /** Same weekday for every day — the common case for a mall. */
  const applyToAllDays = () => {
    const template = rules[0] || { start: '08:00', end: '20:00' };
    setRules(DAYS.map((_, dayOfWeek) => ({ dayOfWeek, start: template.start, end: template.end })));
  };

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await setAvailability(property._id, {
        rules: rules.map((r) => ({ dayOfWeek: r.dayOfWeek, startMinute: r.start, endMinute: r.end })),
        blackoutDates: blackouts,
      });
      setMessage('Calendar saved');
      onSaved?.();
    } catch (err) {
      setError(err.details ? Object.values(err.details)[0] : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-h3 text-ink">{property.title}</h3>
          <p className="mt-0.5 text-caption text-ink-muted">
            {rules.length} weekly rule{rules.length === 1 ? '' : 's'} ·{' '}
            {blackouts.length} blocked date{blackouts.length === 1 ? '' : 's'}
          </p>
        </div>
        {!property.isPublished && (
          <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-caption text-ink-muted">
            Unpublished
          </span>
        )}
      </div>

      {message && <Alert tone="success" className="mt-3">{message}</Alert>}
      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}

      {/* weekly rules */}
      <div className="mt-4 flex flex-col gap-2">
        {rules.map((rule, index) => (
          <div key={`${rule.dayOfWeek}-${index}`} className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Day of week"
              value={rule.dayOfWeek}
              onChange={(e) => updateRule(index, { dayOfWeek: Number(e.target.value) })}
              className="h-9 rounded border border-line bg-surface px-2 text-caption text-ink"
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
            <input
              type="time"
              step="1800"
              aria-label="Opens"
              value={rule.start}
              onChange={(e) => updateRule(index, { start: e.target.value })}
              className="numeric h-9 rounded border border-line bg-surface px-2 text-caption text-ink"
            />
            <span className="text-caption text-ink-muted">to</span>
            <input
              type="time"
              step="1800"
              aria-label="Closes"
              value={rule.end}
              onChange={(e) => updateRule(index, { end: e.target.value })}
              className="numeric h-9 rounded border border-line bg-surface px-2 text-caption text-ink"
            />
            <button
              type="button"
              onClick={() => removeRule(index)}
              className="text-caption text-danger-fg underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {DAYS.map((d, i) => (
          <button
            key={d}
            type="button"
            onClick={() => addRule(i)}
            className={cn(
              'rounded-full border border-line px-2.5 py-1 text-caption text-ink-muted',
              'transition-colors duration-fast hover:border-brand-primary hover:text-ink-brand'
            )}
          >
            + {d.slice(0, 3)}
          </button>
        ))}
        <button
          type="button"
          onClick={applyToAllDays}
          className="rounded-full border border-line px-2.5 py-1 text-caption text-ink-muted hover:border-line-strong"
        >
          Same hours every day
        </button>
      </div>

      {/* blackout dates */}
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-caption font-medium text-ink">Blocked dates</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {blackouts.map((d) => (
            <span
              key={d}
              className="numeric flex items-center gap-2 rounded-full bg-surface-sunken px-2.5 py-1 text-caption text-ink"
            >
              {d}
              <button
                type="button"
                aria-label={`Unblock ${d}`}
                onClick={() => setBlackouts((b) => b.filter((x) => x !== d))}
                className="text-ink-muted hover:text-danger-fg"
              >
                ×
              </button>
            </span>
          ))}
          {!blackouts.length && <span className="text-caption text-ink-subtle">None</span>}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="date"
            aria-label="Block a date"
            value={newBlackout}
            onChange={(e) => setNewBlackout(e.target.value)}
            className="numeric h-9 rounded border border-line bg-surface px-2 text-caption text-ink"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (newBlackout && !blackouts.includes(newBlackout)) {
                setBlackouts((b) => [...b, newBlackout].sort());
              }
              setNewBlackout('');
            }}
          >
            Block date
          </Button>
        </div>
      </div>

      <Button className="mt-5" onClick={save} isLoading={busy}>Save calendar</Button>
    </div>
  );
}
