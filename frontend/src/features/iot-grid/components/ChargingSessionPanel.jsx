'use client';
/**
 * CHARGING SESSION PANEL — OWNER: Maidul Islam [MI]
 *
 * The live telemetry surface: start the charge, watch kW/voltage/kWh stream in
 * over the socket, and stop remotely. Drops into any booking screen.
 *
 * Rendered on `surface-inverse` — the sanctioned dark "cockpit" panel from the
 * design system, used here because this is the one component that is live
 * energy data.
 */
import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';
import { BOOKING_STATUS } from '@/lib/constants';
import { cn } from '@/lib/formatters';
import useIotSocket from '../hooks/useIotSocket';
import { getSession, startSession } from '../api/iot.api';
import LivePowerChart from './LivePowerChart';
import VoltageGauge from './VoltageGauge';
import RemoteShutdownButton from './RemoteShutdownButton';

export default function ChargingSessionPanel({ booking }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [metric, setMetric] = useState('kw');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getSession(booking._id);
      setSession(data.session);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [booking._id]);

  useEffect(() => {
    load();
  }, [load]);

  const { readings, latest, isConnected, isRunning, fault, error: socketError, requestShutdown } =
    useIotSocket({ sessionId: session?._id, bookingId: booking._id, enabled: Boolean(session) });

  async function begin() {
    setStarting(true);
    setError(null);
    try {
      const data = await startSession(booking._id);
      setSession(data.session);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  const canCharge = booking.status === BOOKING_STATUS.ACTIVE;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-line bg-surface-raised p-6">
        <Spinner label="Checking the charger" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-brand-secondary-soft bg-surface-inverse">
      <header className="flex items-center justify-between gap-3 border-b border-brand-secondary-soft px-4 py-3">
        <div>
          <p className="text-overline uppercase text-ink-inverse/60">Charging</p>
          <p className="text-h3 text-ink-inverse">
            {isRunning ? 'Power flowing' : session ? 'Charger idle' : 'Not started'}
          </p>
        </div>

        <span
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-caption font-medium',
            isRunning
              ? 'bg-brand-primary text-white animate-charge-pulse'
              : 'bg-brand-secondary-soft text-ink-inverse/70'
          )}
        >
          {isConnected ? 'live' : 'offline'}
        </span>
      </header>

      <div className="flex flex-col gap-4 p-4">
        {error && <Alert tone="danger">{error}</Alert>}
        {socketError && <Alert tone="warning">{socketError}</Alert>}
        {fault && (
          <Alert tone="danger">
            Charger reported a fault: {fault.faultCode.replace(/_/g, ' ').toLowerCase()}.
          </Alert>
        )}

        {!session ? (
          <>
            <p className="text-body text-ink-inverse/70">
              {canCharge
                ? 'Plug in, then start the charge to begin metering.'
                : 'Check in at the space before starting a charge.'}
            </p>
            <Button onClick={begin} isLoading={starting} disabled={!canCharge} size="lg">
              Start charging
            </Button>
          </>
        ) : (
          <>
            <VoltageGauge latest={latest} session={session} isRunning={isRunning} />

            <div className="flex gap-2">
              {[
                { key: 'kw', label: 'Power' },
                { key: 'voltage', label: 'Voltage' },
                { key: 'current', label: 'Current' },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetric(m.key)}
                  className={cn(
                    'rounded-full px-3 py-1 text-caption font-medium transition-colors duration-fast',
                    metric === m.key
                      ? 'bg-brand-primary text-white'
                      : 'bg-brand-secondary-soft text-ink-inverse/70 hover:text-ink-inverse'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <LivePowerChart readings={readings} isRunning={isRunning} metric={metric} />

            <RemoteShutdownButton
              sessionId={session._id}
              isRunning={isRunning}
              requestShutdown={requestShutdown}
              onShutdown={load}
            />
          </>
        )}
      </div>
    </div>
  );
}
