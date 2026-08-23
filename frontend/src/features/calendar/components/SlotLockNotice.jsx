'use client';
/**
 * SLOT LOCK NOTICE — OWNER: Gourob Gupta [GG]
 * Countdown on an unpaid booking. Shows exactly how long the hold survives so
 * the driver is never surprised by an expiry.
 */
import { useEffect, useState } from 'react';
import Alert from '@/components/ui/Alert';
import { PLATFORM } from '@/lib/constants';

export default function SlotLockNotice({ createdAt, status }) {
  const ttlSeconds = PLATFORM.SLOT_LOCK_TTL_SECONDS || 600;
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (status !== 'PENDING_PAYMENT' || !createdAt) return undefined;

    const tick = () => {
      const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
      setRemaining(Math.max(Math.round(ttlSeconds - elapsed), 0));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [createdAt, status, ttlSeconds]);

  if (status !== 'PENDING_PAYMENT' || remaining === null) return null;

  if (remaining <= 0) {
    return <Alert tone="danger">This hold has expired. The slot has been released.</Alert>;
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, '0');

  return (
    <Alert tone={remaining < 120 ? 'warning' : 'info'}>
      Slot held for <span className="numeric font-medium">{minutes}:{seconds}</span> more. Pay to confirm it.
    </Alert>
  );
}
