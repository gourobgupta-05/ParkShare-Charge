'use client';
/**
 * WITHDRAW PANEL — OWNER: S. Moontaha Rahman [SMR]
 * Amounts are entered in taka and converted to poisha at the boundary.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import { formatMoney, poishaToTaka } from '@/lib/formatters';
import { requestWithdrawal } from '../api/payout.api';

export default function WithdrawPanel({ earnings, onWithdrawn }) {
  const [taka, setTaka] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const balance = earnings?.balancePoisha || 0;
  const min = earnings?.minWithdrawalPoisha || 50000;
  const amountPoisha = Math.round(Number(taka || 0) * 100);

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await requestWithdrawal(amountPoisha);
      setMessage(`${formatMoney(data.batch.grossPoisha)} requested`);
      setTaka('');
      onWithdrawn?.(data);
    } catch (err) {
      setError(err.details ? Object.values(err.details)[0] : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Withdraw earnings"
        subtitle={`Minimum ${formatMoney(min)} · sent to your saved payout method`}
      />
      <CardBody className="flex flex-col gap-3">
        {message && <Alert tone="success">{message}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Amount (BDT)"
            type="number"
            min={poishaToTaka(min)}
            max={poishaToTaka(balance)}
            value={taka}
            onChange={(e) => setTaka(e.target.value)}
            className="max-w-[180px]"
          />
          <Button
            onClick={submit}
            isLoading={busy}
            disabled={amountPoisha < min || amountPoisha > balance}
          >
            Withdraw
          </Button>
          <button
            type="button"
            onClick={() => setTaka(String(poishaToTaka(balance)))}
            className="pb-2 text-caption text-ink-brand underline"
          >
            All ({formatMoney(balance)})
          </button>
        </div>

        <p className="text-caption text-ink-subtle">
          Withdrawals are queued for an operator to disburse. In this build the transfer is recorded
          in the ledger rather than sent to a real bank.
        </p>
      </CardBody>
    </Card>
  );
}
