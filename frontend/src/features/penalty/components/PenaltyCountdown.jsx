'use client';
/**
 * PENALTY COUNTDOWN — OWNER: S. Moontaha Rahman [SMR]
 *
 * The clock on the active session. Counts down to the grace deadline, then
 * counts the money up. Deliberately not alarming until it needs to be — a
 * countdown that shouts from minute one gets ignored by minute thirty.
 */
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Money from '@/components/ui/Money';
import Card, { CardBody } from '@/components/ui/Card';
import { formatMoney, cn } from '@/lib/formatters';
import { getStatus, checkout as checkoutApi } from '../api/penalty.api';

function clock(seconds) {
  const s = Math.max(seconds, 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

export default function PenaltyCountdown({ booking, onCheckedOut }) {
  const [status, setStatus] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!booking?._id) return undefined;
    let cancelled = false;

    const load = () =>
      getStatus(booking._id)
        .then((data) => {
          if (cancelled) return;
          setStatus(data);
          setSeconds(data.secondsRemaining);
        })
        .catch(() => {});

    load();
    // Re-sync with the server every half minute; the local tick handles the rest.
    const poll = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [booking?._id]);

  useEffect(() => {
    const tick = setInterval(() => setSeconds((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(tick);
  }, []);

  if (!status) return null;

  const isLate = status.isLate || seconds <= 0;
  const urgent = !isLate && seconds < 300;

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const data = await checkoutApi(booking._id);
      onCheckedOut?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-overline uppercase text-ink-muted">
              {isLate ? 'Over your booked time' : 'Time to check out'}
            </p>
            <p
              className={cn(
                'numeric font-display text-display-lg',
                isLate ? 'text-danger-fg' : urgent ? 'text-warning-fg' : 'text-ink'
              )}
            >
              {isLate ? `+${status.lateMinutes} min` : clock(seconds)}
            </p>
          </div>

          {isLate && (
            <div className="text-right">
              <p className="text-overline uppercase text-ink-muted">Penalty</p>
              <Money poisha={status.accruedPoisha} emphasis className="text-h1 text-danger-fg" />
            </div>
          )}
        </div>

        {isLate ? (
          <Alert tone="danger">
            {status.cappedOut
              ? `The penalty has reached its ${formatMoney(status.capPoisha)} cap.`
              : `Accruing ${formatMoney(status.ratePoishaPerMin)} per minute. Your account is locked until it is settled.`}
          </Alert>
        ) : (
          <p className="text-caption text-ink-muted">
            You have a {status.graceMinutes}-minute grace period after your slot ends. After that,{' '}
            {formatMoney(status.ratePoishaPerMin)} per minute applies.
          </p>
        )}

        {error && <Alert tone="danger">{error}</Alert>}

        <Button
          onClick={checkout}
          isLoading={busy}
          fullWidth
          size="lg"
          variant={isLate ? 'danger' : 'primary'}
        >
          {isLate ? 'Check out now' : 'Check out'}
        </Button>
      </CardBody>
    </Card>
  );
}
