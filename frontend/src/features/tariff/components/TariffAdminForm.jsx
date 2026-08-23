'use client';
/**
 * TARIFF ADMIN FORM — OWNER: Gourob Gupta [GG]
 * Publishes a BERC rate set and tunes the platform multiplier.
 * The backend rejects slab sets that leave a gap or overlap in the 24-hour
 * day; this form surfaces that error rather than trying to guess a fix.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import { formatMoney } from '@/lib/formatters';
import PeakOffPeakBadge from './PeakOffPeakBadge';
import { publishRateSet, setMultiplier } from '../api/tariff.api';

const PERIODS = ['OFF_PEAK', 'STANDARD', 'PEAK'];

export default function TariffAdminForm({ active, multiplier: initialMultiplier, onChanged }) {
  const [version, setVersion] = useState('');
  const [slabs, setSlabs] = useState(
    (active?.slabs || []).map((s) => ({
      period: s.period,
      startHour: s.startHour,
      endHour: s.endHour,
      poishaPerKwh: s.poishaPerKwh,
    }))
  );
  const [multiplier, setMult] = useState(initialMultiplier ?? 1);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const patch = (i, p) => setSlabs((s) => s.map((slab, idx) => (idx === i ? { ...slab, ...p } : slab)));
  const addSlab = () => setSlabs((s) => [...s, { period: 'STANDARD', startHour: 0, endHour: 1, poishaPerKwh: 850 }]);
  const removeSlab = (i) => setSlabs((s) => s.filter((_, idx) => idx !== i));

  async function publish() {
    setBusy('publish'); setError(null); setMessage(null);
    try {
      const data = await publishRateSet({ version, slabs });
      setMessage(`Rate set ${data.version} is now active`);
      setVersion('');
      onChanged?.();
    } catch (err) {
      setError(err.details ? Object.values(err.details)[0] : err.message);
    } finally {
      setBusy(null);
    }
  }

  async function saveMultiplier() {
    setBusy('multiplier'); setError(null); setMessage(null);
    try {
      await setMultiplier(Number(multiplier));
      setMessage('Multiplier saved');
      onChanged?.();
    } catch (err) {
      setError(err.details ? Object.values(err.details)[0] : err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardHeader
          title="Platform multiplier"
          subtitle="Applied on top of every BERC rate and the host's overhead"
        />
        <CardBody className="flex flex-wrap items-end gap-3">
          <Input
            label="Multiplier"
            type="number"
            step="0.05"
            min="0.1"
            max="5"
            value={multiplier}
            onChange={(e) => setMult(e.target.value)}
            className="max-w-[140px]"
          />
          <Button onClick={saveMultiplier} isLoading={busy === 'multiplier'}>Save</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Publish a rate set"
          subtitle="Slabs must cover all 24 hours exactly once — no gaps, no overlaps"
        />
        <CardBody>
          <div className="flex flex-col gap-2">
            {slabs.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Period"
                  value={s.period}
                  onChange={(e) => patch(i, { period: e.target.value })}
                  className="h-9 rounded border border-line bg-surface px-2 text-caption text-ink"
                >
                  {PERIODS.map((p) => <option key={p} value={p}>{p.replace(/_/g, '-')}</option>)}
                </select>
                <input
                  type="number" min="0" max="23" aria-label="Start hour"
                  value={s.startHour}
                  onChange={(e) => patch(i, { startHour: Number(e.target.value) })}
                  className="numeric h-9 w-16 rounded border border-line bg-surface px-2 text-caption text-ink"
                />
                <span className="text-caption text-ink-muted">to</span>
                <input
                  type="number" min="1" max="24" aria-label="End hour"
                  value={s.endHour}
                  onChange={(e) => patch(i, { endHour: Number(e.target.value) })}
                  className="numeric h-9 w-16 rounded border border-line bg-surface px-2 text-caption text-ink"
                />
                <input
                  type="number" min="0" aria-label="Poisha per kWh"
                  value={s.poishaPerKwh}
                  onChange={(e) => patch(i, { poishaPerKwh: Number(e.target.value) })}
                  className="numeric h-9 w-24 rounded border border-line bg-surface px-2 text-caption text-ink"
                />
                <span className="numeric text-caption text-ink-muted">
                  = {formatMoney(s.poishaPerKwh)}/kWh
                </span>
                <button type="button" onClick={() => removeSlab(i)} className="text-caption text-danger-fg underline">
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Button size="sm" variant="outline" onClick={addSlab}>Add slab</Button>
            <Input
              label="Version"
              placeholder="2026-01"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="max-w-[160px]"
            />
            <Button onClick={publish} isLoading={busy === 'publish'} disabled={!version || !slabs.length}>
              Publish &amp; activate
            </Button>
          </div>
        </CardBody>
      </Card>

      {active?.slabs?.length > 0 && (
        <Card>
          <CardHeader title={`Currently active: ${active.version}`} subtitle={`Source: ${active.source}`} />
          <CardBody className="flex flex-col gap-2">
            {active.slabs.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <PeakOffPeakBadge period={s.period} />
                  <span className="numeric text-caption text-ink-muted">
                    {String(s.startHour).padStart(2, '0')}:00 – {String(s.endHour).padStart(2, '0')}:00
                  </span>
                </span>
                <span className="numeric text-caption text-ink">{formatMoney(s.poishaPerKwh)}/kWh</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
