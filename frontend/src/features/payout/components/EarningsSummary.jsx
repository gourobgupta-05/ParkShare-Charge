'use client';
/**
 * EARNINGS SUMMARY — OWNER: S. Moontaha Rahman [SMR]
 * The host's money at a glance. Shows the commission taken explicitly rather
 * than hiding it — a host who discovers the 12% later trusts the platform less
 * than one who saw it on day one.
 */
import Money from '@/components/ui/Money';
import Card, { CardBody } from '@/components/ui/Card';
import { formatMoney } from '@/lib/formatters';

function Stat({ label, poisha, tone = 'default', sub }) {
  return (
    <Card>
      <CardBody>
        <p className="text-overline uppercase text-ink-muted">{label}</p>
        <p className="mt-1 font-display text-h1">
          <Money
            poisha={poisha}
            className={
              tone === 'brand' ? 'text-ink-brand' : tone === 'muted' ? 'text-ink-muted' : 'text-ink'
            }
          />
        </p>
        {sub && <p className="mt-0.5 text-caption text-ink-subtle">{sub}</p>}
      </CardBody>
    </Card>
  );
}

export default function EarningsSummary({ earnings }) {
  if (!earnings) return null;
  const { lifetime, pending, effectiveCommissionRate } = earnings;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Available balance" poisha={earnings.balancePoisha} tone="brand" sub="Ready to withdraw" />
        <Stat
          label="Held in escrow"
          poisha={pending?.pendingPoisha || 0}
          tone="muted"
          sub={`${pending?.count || 0} session${pending?.count === 1 ? '' : 's'} not yet settled`}
        />
        <Stat
          label="Lifetime earnings"
          poisha={lifetime?.hostCreditPoisha || 0}
          sub={`${lifetime?.sessions || 0} settled session${lifetime?.sessions === 1 ? '' : 's'}`}
        />
      </div>

      {lifetime?.grossPoisha > 0 && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-caption text-ink-muted">
                Of <span className="numeric">{formatMoney(lifetime.grossPoisha)}</span> collected from drivers,
                you kept <span className="numeric font-medium text-ink-brand">
                  {formatMoney(lifetime.hostCreditPoisha)}
                </span>
                .
              </p>
              <p className="mt-0.5 text-caption text-ink-subtle">
                Platform commission: {formatMoney(lifetime.commissionPoisha)}
                {effectiveCommissionRate !== null && ` (${(effectiveCommissionRate * 100).toFixed(1)}%)`}
              </p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
