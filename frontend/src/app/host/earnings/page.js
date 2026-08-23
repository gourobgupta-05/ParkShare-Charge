'use client';
/**
 * HOST EARNINGS — OWNER: S. Moontaha Rahman [SMR]
 */
import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import EarningsSummary from '@/features/payout/components/EarningsSummary';
import PayoutHistory from '@/features/payout/components/PayoutHistory';
import LedgerTable from '@/features/payout/components/LedgerTable';
import WithdrawPanel from '@/features/payout/components/WithdrawPanel';
import { getEarnings, getLedger } from '@/features/payout/api/payout.api';

function EarningsScreen() {
  const [earnings, setEarnings] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setIsLoading(true);
    Promise.all([getEarnings(), getLedger()])
      .then(([e, l]) => {
        setEarnings(e);
        setLedger(l);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Earnings</h1>
        <p className="mt-1 text-body text-ink-muted">
          Funds are released from escrow automatically when a session completes.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <div className="py-10"><Spinner label="Loading your earnings" /></div>
      ) : (
        <>
          <EarningsSummary earnings={earnings} />
          <WithdrawPanel earnings={earnings} onWithdrawn={load} />

          <Card>
            <CardHeader title="Payout history" />
            <CardBody>
              <PayoutHistory batches={earnings?.recentBatches || []} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Ledger" subtitle="Append-only record of every movement" />
            <CardBody>
              <LedgerTable entries={ledger?.items || []} />
            </CardBody>
          </Card>
        </>
      )}
    </main>
  );
}

export default function HostEarningsPage() {
  return (
    <ProtectedRoute roles={[ROLES.HOST, ROLES.ADMIN]}>
      <EarningsScreen />
    </ProtectedRoute>
  );
}
