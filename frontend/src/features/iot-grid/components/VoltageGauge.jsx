'use client';
/**
 * VOLTAGE / POWER READOUT — OWNER: Maidul Islam [MI]
 * The four live numbers, in mono so they don't jitter as digits change.
 */
import { cn } from '@/lib/formatters';

function Stat({ label, value, unit, tone = 'default' }) {
  return (
    <div className="rounded-lg border border-line bg-surface-raised px-3 py-2">
      <p className="text-overline uppercase text-ink-muted">{label}</p>
      <p
        className={cn(
          'numeric mt-0.5 text-h2',
          tone === 'brand' ? 'text-ink-brand' : tone === 'danger' ? 'text-danger-fg' : 'text-ink'
        )}
      >
        {value}
        <span className="ml-1 text-caption text-ink-muted">{unit}</span>
      </p>
    </div>
  );
}

export default function VoltageGauge({ latest, session, isRunning }) {
  const kw = Number(latest?.kw ?? 0);
  const voltage = Number(latest?.voltage ?? 0);
  const current = Number(latest?.current ?? 0);
  const kwh = Number(latest?.cumulativeKwh ?? session?.totalKwh ?? 0);

  // Dhaka feeders nominally sit at 220 V; outside this band is worth flagging.
  const voltageOutOfBand = voltage > 0 && (voltage < 200 || voltage > 240);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Power" value={kw.toFixed(2)} unit="kW" tone={isRunning ? 'brand' : 'default'} />
      <Stat
        label="Voltage"
        value={voltage.toFixed(1)}
        unit="V"
        tone={voltageOutOfBand ? 'danger' : 'default'}
      />
      <Stat label="Current" value={current.toFixed(1)} unit="A" />
      <Stat label="Delivered" value={kwh.toFixed(2)} unit="kWh" tone="brand" />
    </div>
  );
}
