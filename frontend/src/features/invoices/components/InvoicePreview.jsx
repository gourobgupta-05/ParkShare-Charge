'use client';
/**
 * INVOICE PREVIEW — OWNER: Gourob Gupta [GG]
 * On-screen mirror of the PDF. Deliberately renders the same line items in the
 * same order, so what the driver sees before downloading is what they get.
 */
import Money from '@/components/ui/Money';
import Card, { CardBody } from '@/components/ui/Card';
import { formatDateTime, formatMoney, cn } from '@/lib/formatters';
import PeakOffPeakBadge from '@/features/tariff/components/PeakOffPeakBadge';
import DownloadInvoiceButton from './DownloadInvoiceButton';

const LINE_LABELS = {
  PARKING: 'Parking fee',
  ENERGY: 'Electricity (BERC tariff)',
  DISCOUNT: 'Promotional discount',
  VAT: 'VAT',
  FEE: 'Payment processing fee',
};

export default function InvoicePreview({ invoice, energyBreakdown }) {
  if (!invoice) return null;

  const chargeLines = invoice.lines.filter((l) => l.code !== 'VAT' && l.code !== 'FEE');
  const taxLines = invoice.lines.filter((l) => l.code === 'VAT' || l.code === 'FEE');
  const taxable = invoice.basePoisha + invoice.energyPoisha - invoice.discountPoisha;

  return (
    <Card>
      <CardBody className="flex flex-col gap-5">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="text-overline uppercase text-ink-brand">Tax invoice</p>
            <p className="numeric mt-1 font-display text-h1 text-ink">{invoice.invoiceNo}</p>
            <p className="mt-0.5 text-caption text-ink-muted">
              Issued {formatDateTime(invoice.issuedAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-body font-medium text-ink">{invoice.issuer?.name}</p>
            <p className="text-caption text-ink-muted">{invoice.issuer?.address}</p>
            {invoice.issuer?.bin && (
              <p className="numeric text-caption text-ink-muted">BIN: {invoice.issuer.bin}</p>
            )}
          </div>
        </div>

        {/* parties */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-overline uppercase text-ink-muted">Billed to</p>
            <p className="mt-1 text-body text-ink">{invoice.billedTo?.name || '—'}</p>
            <p className="text-caption text-ink-muted">{invoice.billedTo?.email}</p>
            <p className="numeric text-caption text-ink-muted">{invoice.billedTo?.phone}</p>
          </div>
          <div>
            <p className="text-overline uppercase text-ink-muted">Space</p>
            <p className="mt-1 text-body text-ink">{invoice.propertySnapshot?.title || '—'}</p>
            <p className="text-caption text-ink-muted">{invoice.propertySnapshot?.address}</p>
            <p className="text-caption text-ink-muted">
              {invoice.propertySnapshot?.propertyType === 'MALL' ? 'Commercial mall' : 'Residential'}
              {invoice.propertySnapshot?.hostName ? ` · ${invoice.propertySnapshot.hostName}` : ''}
            </p>
          </div>
        </div>

        {/* session strip */}
        <div className="rounded bg-surface-sunken px-3 py-2 text-caption text-ink-muted">
          <span className="numeric">
            {formatDateTime(invoice.periodStart)} → {formatDateTime(invoice.periodEnd)}
          </span>
          {invoice.totalKwh > 0 && (
            <span className="numeric"> · {invoice.totalKwh.toFixed(2)} kWh metered</span>
          )}
          {invoice.tariffVersion && <span> · BERC {invoice.tariffVersion}</span>}
        </div>

        {/* lines */}
        <div className="flex flex-col">
          {chargeLines.map((line) => (
            <div key={line.code} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-body text-ink">{line.description || LINE_LABELS[line.code]}</p>
                {line.detail && <p className="text-caption text-ink-subtle">{line.detail}</p>}
              </div>
              <span
                className={cn(
                  'numeric shrink-0 text-body',
                  line.code === 'DISCOUNT' ? 'text-ink-brand' : 'text-ink'
                )}
              >
                {line.code === 'DISCOUNT' ? '−' : ''}
                {formatMoney(Math.abs(line.amountPoisha))}
              </span>
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-line py-2">
            <span className="text-caption text-ink-muted">Taxable amount</span>
            <Money poisha={taxable} className="text-body" />
          </div>

          {taxLines.map((line) => (
            <div key={line.code} className="flex items-start justify-between gap-3 py-1">
              <div>
                <span className="text-caption text-ink-muted">
                  {line.description || LINE_LABELS[line.code]}
                </span>
                {line.detail && <p className="text-caption text-ink-subtle">{line.detail}</p>}
              </div>
              <span className="numeric text-caption text-ink-muted">
                {formatMoney(line.amountPoisha)}
              </span>
            </div>
          ))}
        </div>

        {/* total */}
        <div className="flex items-center justify-between rounded-lg bg-surface-sunken px-4 py-3">
          <span className="text-h3 text-ink">Total paid</span>
          <Money poisha={invoice.totalPoisha} emphasis className="text-h1 text-ink-brand" />
        </div>

        {/* energy breakdown */}
        {energyBreakdown?.periods?.length > 0 && (
          <div className="border-t border-line pt-4">
            <p className="text-overline uppercase text-ink-muted">
              Electricity breakdown (BERC time-of-use)
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {energyBreakdown.periods.map((p, i) => (
                <div key={`${p.period}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <PeakOffPeakBadge period={p.period} />
                    <span className="numeric text-caption text-ink-muted">
                      {p.hours} h · {Number(p.kwh).toFixed(2)} kWh
                    </span>
                  </span>
                  <span className="numeric text-caption text-ink">
                    {formatMoney(p.effectivePoishaPerKwh)}/kWh = {formatMoney(p.linePoisha)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line pt-4">
          <p className="max-w-md text-caption text-ink-subtle">
            VAT charged at {(invoice.vatRate * 100).toFixed(0)}% of the taxable amount. Computer
            generated — no signature required.
          </p>
          <DownloadInvoiceButton invoiceId={invoice._id} invoiceNo={invoice.invoiceNo} />
        </div>
      </CardBody>
    </Card>
  );
}
