'use client';
/**
 * DISPUTE / HOLD TABLE — OWNER: Tamal Deb Nath [TDN]
 * Admin view of every escrow hold, with a refund action.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Money from '@/components/ui/Money';
import EmptyState from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/formatters';
import HoldStatusBadge from './HoldStatusBadge';
import { refundBooking } from '../api/escrow.api';

export default function DisputeTable({ holds = [], onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function refund(hold) {
    const reason = window.prompt('Reason for the refund?', 'Resolved in the driver’s favour');
    if (reason === null) return;

    setBusyId(String(hold._id));
    setError(null);
    setMessage(null);
    try {
      const data = await refundBooking(hold.bookingId, { reason });
      setMessage(`Refunded on booking ${String(data.bookingId).slice(-6)}`);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!holds.length) {
    return <EmptyState title="No escrow holds yet" description="Holds appear here once drivers start paying for bookings." />;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="danger">{error}</Alert>}
      {message && <Alert tone="success">{message}</Alert>}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-body">
          <thead className="bg-surface-sunken text-caption text-ink-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Booking</th>
              <th className="px-4 py-2 text-left font-medium">Driver</th>
              <th className="px-4 py-2 text-left font-medium">Host</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Held</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {holds.map((hold) => (
              <tr key={hold._id} className="border-t border-line">
                <td className="numeric px-4 py-3 text-caption text-ink-muted">
                  {String(hold.bookingId).slice(-8)}
                </td>
                <td className="px-4 py-3 text-ink">{hold.driverId?.name || '—'}</td>
                <td className="px-4 py-3 text-ink">
                  {hold.hostId?.businessName || hold.hostId?.name || '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Money poisha={hold.amountPoisha} />
                </td>
                <td className="px-4 py-3">
                  <HoldStatusBadge status={hold.status} />
                </td>
                <td className="px-4 py-3 text-caption text-ink-muted">
                  {hold.heldAt ? formatDateTime(hold.heldAt) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {hold.status === 'HELD' && (
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={busyId === String(hold._id)}
                      onClick={() => refund(hold)}
                    >
                      Refund
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
