'use client';
/**
 * WALLET BALANCE CARD — OWNER: Tamal Deb Nath [TDN]
 */
import Card, { CardBody } from '@/components/ui/Card';
import Money from '@/components/ui/Money';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';

export default function WalletBalanceCard({ wallet, isLoading, onTopUp }) {
  if (isLoading && !wallet) {
    return (
      <Card>
        <CardBody className="flex justify-center py-8">
          <Spinner label="Loading your wallet" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card inverse>
      <CardBody>
        <p className="text-overline uppercase text-ink-inverse/70">Wallet balance</p>

        <p className="mt-1 font-display text-display text-ink-inverse">
          <Money poisha={wallet?.balancePoisha ?? 0} className="text-ink-inverse" />
        </p>

        {wallet?.escrowPoisha > 0 && (
          <p className="mt-1 text-caption text-ink-inverse/70">
            <Money poisha={wallet.escrowPoisha} className="text-ink-inverse/70" /> currently held in escrow
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={onTopUp} size="sm">Add money</Button>
          <span className="text-caption text-ink-inverse/60">
            via {wallet?.gateway || 'mock'} gateway
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
