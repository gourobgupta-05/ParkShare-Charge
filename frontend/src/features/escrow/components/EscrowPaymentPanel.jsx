'use client';
/**
 * ESCROW PAYMENT PANEL — OWNER: Tamal Deb Nath [TDN]
 *
 * The checkout step. Shows the fare breakdown, checks the wallet covers it,
 * and fires the ACID hold. On INSUFFICIENT_WALLET_BALANCE it offers top-up
 * inline rather than dead-ending the driver.
 *
 * Drop into any booking screen:
 *   <EscrowPaymentPanel booking={booking} onPaid={refresh} />
 */
import { useState } from 'react';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Money from '@/components/ui/Money';
import { ERROR_CODES } from '@/lib/constants';
import { formatMoney } from '@/lib/formatters';
import useWallet from '../hooks/useWallet';
import { holdFunds } from '../api/escrow.api';
import HoldStatusBadge from './HoldStatusBadge';
import TopUpModal from './TopUpModal';

function Row({ label, poisha, muted, negative }) {
  if (!poisha) return null;
  return (
    <div className="flex items-center justify-between py-1">
      <span className={muted ? 'text-caption text-ink-muted' : 'text-body text-ink'}>{label}</span>
      <span className={muted ? 'numeric text-caption text-ink-muted' : 'numeric text-body text-ink'}>
        {negative ? '−' : ''}
        {formatMoney(poisha)}
      </span>
    </div>
  );
}

export default function EscrowPaymentPanel({ booking, onPaid }) {
  const { wallet, isLoading, refresh, topUp } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [shortfall, setShortfall] = useState(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [result, setResult] = useState(null);

  const pricing = booking?.pricing || {};
  const total = pricing.totalPoisha || 0;
  const escrowStatus = result?.status || booking?.escrow?.status || 'NONE';
  const alreadyPaid = escrowStatus === 'HELD' || escrowStatus === 'RELEASED';

  async function pay() {
    setBusy(true);
    setError(null);
    setShortfall(null);
    try {
      const data = await holdFunds({ bookingId: booking._id });
      setResult(data);
      await refresh();
      onPaid?.(data);
    } catch (err) {
      setError(err.message);
      if (err.code === ERROR_CODES.INSUFFICIENT_WALLET_BALANCE) {
        setShortfall(err.details?.shortfallPoisha ?? null);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Payment"
        subtitle="Funds are held in escrow and released to the host after your session"
        action={<HoldStatusBadge status={escrowStatus} />}
      />
      <CardBody>
        <Row label="Parking fee" poisha={pricing.basePoisha} />
        <Row label="Electricity" poisha={pricing.energyPoisha} />
        <Row label="Promo discount" poisha={pricing.discountPoisha} muted negative />
        <Row label="VAT" poisha={pricing.vatPoisha} muted />
        <Row label="Processing fee" poisha={pricing.processingFeePoisha} muted />

        <div className="mt-2 flex items-center justify-between border-t border-line-strong pt-3">
          <span className="text-h3 text-ink">Total</span>
          <Money poisha={total} emphasis className="text-h2" />
        </div>

        {!alreadyPaid && (
          <p className="mt-3 text-caption text-ink-muted">
            Wallet balance{' '}
            <span className="numeric font-medium text-ink">
              {isLoading ? '…' : formatMoney(wallet?.balancePoisha ?? 0)}
            </span>
          </p>
        )}

        {error && (
          <Alert tone="danger" className="mt-4">
            {error}
            {shortfall !== null && (
              <button
                type="button"
                onClick={() => setShowTopUp(true)}
                className="ml-1 font-medium underline"
              >
                Add {formatMoney(shortfall)} now
              </button>
            )}
          </Alert>
        )}

        {alreadyPaid ? (
          <Alert tone="success" className="mt-4">
            <Money poisha={result?.amountPoisha ?? booking?.escrow?.heldPoisha ?? total} /> is held in
            escrow. Your booking is confirmed.
          </Alert>
        ) : (
          <Button className="mt-4" fullWidth size="lg" onClick={pay} isLoading={busy} disabled={total <= 0}>
            Pay {formatMoney(total)} into escrow
          </Button>
        )}

        <p className="mt-3 text-caption text-ink-subtle">
          Cancel before your session starts for a full refund. Payment instruments are tokenized —
          we never store card or wallet numbers.
        </p>
      </CardBody>

      <TopUpModal
        open={showTopUp}
        onClose={() => setShowTopUp(false)}
        onTopUp={async (amount) => {
          const r = await topUp(amount);
          setShortfall(null);
          setError(null);
          return r;
        }}
      />
    </Card>
  );
}
