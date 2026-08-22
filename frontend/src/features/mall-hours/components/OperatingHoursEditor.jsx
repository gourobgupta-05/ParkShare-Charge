'use client';
/**
 * OPERATING HOURS EDITOR — OWNER: Tamal Deb Nath [TDN]
 * Host-side control for a mall's opening and closing time. Times are entered
 * and displayed in Asia/Dhaka local time, which is what the backend guard
 * compares against.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { PROPERTY_TYPE } from '@/lib/constants';
import { updateHours } from '../api/mallHours.api';

const toLabel = (minutes) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export default function OperatingHoursEditor({ property, onSaved }) {
  const h = property.operatingHours || {};
  const [is24x7, setIs24x7] = useState(Boolean(h.is24x7));
  const [opens, setOpens] = useState(toLabel(h.openMinute ?? 480));
  const [closes, setCloses] = useState(toLabel(h.closeMinute ?? 1320));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const isMall = property.propertyType === PROPERTY_TYPE.MALL;

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await updateHours(property._id, { is24x7, opens, closes });
      setMessage(`Saved — ${data.display}`);
      onSaved?.(data);
    } catch (err) {
      setError(err.details?.closeMinute || err.details?.openMinute || err.message);
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
            {isMall ? 'Commercial mall — the closing-time guard applies' : 'Residential — guard does not apply'}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-caption font-medium text-white ${
            isMall ? 'bg-property-mall' : 'bg-property-residential'
          }`}
        >
          {isMall ? 'Mall' : 'Residential'}
        </span>
      </div>

      {message && <Alert tone="success" className="mt-3">{message}</Alert>}
      {error && <Alert tone="danger" className="mt-3">{error}</Alert>}

      <label className="mt-4 flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand-primary"
          checked={is24x7}
          onChange={(e) => setIs24x7(e.target.checked)}
        />
        <span className="text-body text-ink">Open 24/7</span>
      </label>

      {!is24x7 && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`open-${property._id}`} className="text-caption font-medium text-ink">
              Opens
            </label>
            <input
              id={`open-${property._id}`}
              type="time"
              value={opens}
              onChange={(e) => setOpens(e.target.value)}
              className="numeric h-10 rounded border border-line bg-surface px-3 text-body text-ink"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`close-${property._id}`} className="text-caption font-medium text-ink">
              Closes
            </label>
            <input
              id={`close-${property._id}`}
              type="time"
              value={closes}
              onChange={(e) => setCloses(e.target.value)}
              className="numeric h-10 rounded border border-line bg-surface px-3 text-body text-ink"
            />
          </div>
        </div>
      )}

      <p className="mt-3 text-caption text-ink-subtle">
        Bookings that would end after closing time are rejected automatically. Unpaid bookings that
        breach a shortened closing time are expired by the guard worker.
      </p>

      <Button className="mt-4" onClick={save} isLoading={busy} size="sm">
        Save hours
      </Button>
    </div>
  );
}
