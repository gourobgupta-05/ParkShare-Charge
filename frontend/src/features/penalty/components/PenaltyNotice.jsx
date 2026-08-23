'use client';
/**
 * PENALTY NOTICE — OWNER: S. Moontaha Rahman [SMR]
 * Compact banner listing outstanding penalties, for the bookings screen.
 */
import { useEffect, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import { formatMoney } from '@/lib/formatters';
import { listMine } from '../api/penalty.api';
import AccountLockedModal from './AccountLockedModal';

export default function PenaltyNotice({ onSettled }) {
  const [data, setData] = useState(null);
  const [active, setActive] = useState(null);

  const load = () => listMine().then(setData).catch(() => setData(null));

  useEffect(() => {
    load();
  }, []);

  const outstanding = (data?.items || []).filter((p) => p.status === 'ACCRUING');
  if (!outstanding.length) return null;

  return (
    <>
      <Alert tone="danger">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            You owe <span className="numeric font-medium">{formatMoney(data.outstandingPoisha)}</span>{' '}
            in overstay penalties. Your account is locked until it is settled.
          </span>
          <Button size="sm" variant="danger" onClick={() => setActive(outstanding[0])}>
            Settle now
          </Button>
        </div>
      </Alert>

      <AccountLockedModal
        penalty={active}
        open={Boolean(active)}
        onClose={() => setActive(null)}
        onSettled={(result) => {
          load();
          onSettled?.(result);
        }}
      />
    </>
  );
}
