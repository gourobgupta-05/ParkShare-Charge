'use client';
/**
 * REMOTE SHUTDOWN — OWNER: Maidul Islam [MI]
 * Sends the stop command over the socket, falling back to REST when the
 * socket is down. Destructive, so it asks first.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { stopSession } from '../api/iot.api';

export default function RemoteShutdownButton({ sessionId, isRunning, onShutdown, requestShutdown }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!isRunning) return null;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      // Socket first — it is instant and echoes to every open tab.
      if (requestShutdown) {
        await requestShutdown('DRIVER_STOP');
      } else {
        await stopSession(sessionId, 'DRIVER_STOP');
      }
      setConfirming(false);
      onShutdown?.();
    } catch (err) {
      // Socket path failed; try the REST route before giving up.
      try {
        await stopSession(sessionId, 'DRIVER_STOP');
        setConfirming(false);
        onShutdown?.();
      } catch (restErr) {
        setError(restErr.message || err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <Alert tone="danger">{error}</Alert>}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-ink-muted">Stop charging now?</span>
          <Button size="sm" variant="danger" onClick={run} isLoading={busy}>
            Yes, stop
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Keep charging
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
          Stop charging
        </Button>
      )}
    </div>
  );
}
