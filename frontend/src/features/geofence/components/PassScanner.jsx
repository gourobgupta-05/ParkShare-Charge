'use client';
/**
 * PASS SCANNER — OWNER: S. Moontaha Rahman [SMR]
 *
 * Host-side verification. Camera QR decoding needs a scanning library, so the
 * primary path here is pasting or typing the token the driver shows — which is
 * also the path that works when a basement camera cannot focus. The endpoint
 * is identical either way, so adding camera capture later changes nothing
 * server-side.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/formatters';
import { verifyPass } from '../api/geofence.api';

export default function PassScanner() {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function verify() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await verifyPass(token.trim());
      setResult(data);
      setToken('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Verify an entry pass"
        subtitle="Paste the code the driver shows you at the gate"
      />
      <CardBody className="flex flex-col gap-3">
        {error && <Alert tone="danger">{error}</Alert>}

        {result && (
          <Alert tone="success">
            <span className="font-medium">
              {result.alreadyCheckedIn ? 'Already checked in' : 'Pass accepted'}
            </span>
            <p className="mt-1">
              {result.property?.title} · session until{' '}
              <span className="numeric">{formatDateTime(result.window?.endAt)}</span>
            </p>
          </Alert>
        )}

        <textarea
          rows={3}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste the pass code…"
          className="numeric w-full rounded border border-line bg-surface px-3 py-2 text-caption text-ink placeholder:text-ink-subtle"
        />

        <Button onClick={verify} isLoading={busy} disabled={!token.trim()}>
          Verify pass
        </Button>

        <p className="text-caption text-ink-subtle">
          Passes expire a few minutes after they are generated, so an old screenshot will not work.
        </p>
      </CardBody>
    </Card>
  );
}
