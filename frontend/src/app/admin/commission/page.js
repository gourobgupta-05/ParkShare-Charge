'use client';
/**
 * ADMIN — COMMISSION & PAYOUTS — OWNER: S. Moontaha Rahman [SMR]
 */
import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/lib/constants';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Money from '@/components/ui/Money';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import PayoutHistory from '@/features/payout/components/PayoutHistory';
import { getCommission, setCommission, listBatches } from '@/features/payout/api/payout.api';

function CommissionScreen() {
  const [data, setData] = useState(null);
  const [batches, setBatches] = useState(null);
  const [percent, setPercent] = useState('12');
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(() => {
    setIsLoading(true);
    Promise.all([getCommission(), listBatches()])
      .then(([c, b]) => {
        setData(c);
        setBatches(b);
        setPercent(String((c.commissionRate * 100).toFixed(1)));
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await setCommission(Number(percent) / 100);
      setMessage(`Commission set to ${(result.commissionRate * 100).toFixed(1)}%`);
      load();
    } catch (err) {
      setError(err.details?.commissionRate || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Commission &amp; payouts</h1>
        <p className="mt-1 text-body text-ink-muted">
          Changing the rate affects future settlements only — historical records keep the rate that applied.
        </p>
      </div>

      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      {isLoading ? (
        <div className="py-10"><Spinner label="Loading platform revenue" /></div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardBody>
                <p className="text-overline uppercase text-ink-muted">Commission earned</p>
                <p className="mt-1 font-display text-h1 text-ink-brand">
                  <Money poisha={data?.revenue?.commissionPoisha || 0} />
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-overline uppercase text-ink-muted">Gross processed</p>
                <p className="mt-1 font-display text-h1 text-ink">
                  <Money poisha={data?.revenue?.grossPoisha || 0} />
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-overline uppercase text-ink-muted">Settlements</p>
                <p className="numeric mt-1 font-display text-h1 text-ink">
                  {data?.revenue?.settlements || 0}
                </p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Platform commission" subtitle="Taken from each completed session" />
            <CardBody className="flex flex-wrap items-end gap-3">
              <Input
                label="Commission (%)"
                type="number"
                step="0.5"
                min="0"
                max="50"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="max-w-[140px]"
              />
              <Button onClick={save} isLoading={busy}>Save</Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="All payouts" subtitle="Settlements and withdrawal requests" />
            <CardBody>
              <PayoutHistory batches={batches?.items || []} />
            </CardBody>
          </Card>
        </>
      )}
    </main>
  );
}

export default function AdminCommissionPage() {
  return (
    <ProtectedRoute roles={[ROLES.ADMIN]}>
      <CommissionScreen />
    </ProtectedRoute>
  );
}
