'use client';
/**
 * WALLET — OWNER: Tamal Deb Nath [TDN]
 * Balance, top-up, escrow holds and the ledger of recent movements.
 */
import { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Money from '@/components/ui/Money';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/formatters';
import useWallet from '@/features/escrow/hooks/useWallet';
import WalletBalanceCard from '@/features/escrow/components/WalletBalanceCard';
import TopUpModal from '@/features/escrow/components/TopUpModal';
import HoldStatusBadge from '@/features/escrow/components/HoldStatusBadge';
import { listMyHolds, confirmTopUp } from '@/features/escrow/api/escrow.api';

function WalletScreen() {
  const { wallet, isLoading, error, refresh, topUp } = useWallet();
  const [showTopUp, setShowTopUp] = useState(false);
  const [holds, setHolds] = useState([]);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    listMyHolds().then((d) => setHolds(d.items || [])).catch(() => setHolds([]));
  }, [wallet?.balancePoisha]);

  // Handles the return leg from a hosted gateway (?mockToken= or ?val_id=).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('mockToken') || params.get('val_id');
    if (!token) return;

    confirmTopUp({
      token,
      amountPoisha: Number(params.get('amount')) || undefined,
      val_id: params.get('val_id') || undefined,
    })
      .then((data) => {
        setNotice(data.alreadyProcessed ? 'That top-up was already credited.' : 'Top-up received.');
        refresh();
      })
      .catch((err) => setNotice(err.message))
      .finally(() => window.history.replaceState({}, '', '/wallet'));
  }, [refresh]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <h1 className="text-h1">Wallet</h1>

      {notice && <Alert tone="info">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <WalletBalanceCard wallet={wallet} isLoading={isLoading} onTopUp={() => setShowTopUp(true)} />

      <Card>
        <CardHeader title="Escrow holds" subtitle="Money locked against upcoming bookings" />
        <CardBody>
          {holds.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {holds.map((h) => (
                <li key={h._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="numeric truncate text-body text-ink">
                      Booking {String(h.bookingId).slice(-8)}
                    </p>
                    <p className="text-caption text-ink-muted">
                      {h.heldAt ? formatDateTime(h.heldAt) : '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Money poisha={h.amountPoisha} />
                    <HoldStatusBadge status={h.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No escrow holds" description="Book a space and your payment will appear here." />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Recent activity" subtitle="Every movement, newest first" />
        <CardBody>
          {wallet?.recentEntries?.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {wallet.recentEntries.map((e) => (
                <li key={e._id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-body text-ink">{e.type.replace(/_/g, ' ').toLowerCase()}</p>
                    <p className="text-caption text-ink-muted">{formatDateTime(e.createdAt)}</p>
                  </div>
                  <Money poisha={e.amountPoisha} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing yet" description="Add money to get started." />
          )}
        </CardBody>
      </Card>

      <TopUpModal open={showTopUp} onClose={() => setShowTopUp(false)} onTopUp={topUp} />
    </main>
  );
}

export default function WalletPage() {
  return (
    <ProtectedRoute>
      <WalletScreen />
    </ProtectedRoute>
  );
}
