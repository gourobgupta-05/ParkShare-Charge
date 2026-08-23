'use client';
/**
 * PROMO ADMIN TABLE — OWNER: Maidul Islam [MI]
 * Create partner campaigns and switch them on or off.
 * Amounts are entered in taka and converted to poisha at the boundary, so no
 * float ever reaches the API.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import Money from '@/components/ui/Money';
import EmptyState from '@/components/ui/EmptyState';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import { PROPERTY_TYPE } from '@/lib/constants';
import { formatDate, cn } from '@/lib/formatters';
import { createCode, updateCode } from '../api/promo.api';

const SCOPES = [
  { value: '', label: 'Any space' },
  { value: PROPERTY_TYPE.MALL, label: 'Commercial mall only' },
  { value: PROPERTY_TYPE.RESIDENTIAL, label: 'Residential only' },
];

const EMPTY = {
  code: '',
  partnerName: '',
  description: '',
  discountTaka: '20',
  minSpendTaka: '0',
  propertyType: PROPERTY_TYPE.MALL,
  usageLimit: '',
  perUserLimit: '1',
  validTo: '',
};

export default function PromoAdminTable({ codes = [], onChanged }) {
  const [form, setForm] = useState(EMPTY);
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function create() {
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        partnerName: form.partnerName.trim() || undefined,
        description: form.description.trim() || undefined,
        discountPoisha: Math.round(Number(form.discountTaka) * 100),
        minSpendPoisha: Math.round(Number(form.minSpendTaka || 0) * 100),
        propertyType: form.propertyType || undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        perUserLimit: Number(form.perUserLimit || 1),
        validTo: form.validTo || undefined,
      };
      const promo = await createCode(payload);
      setMessage(`${promo.code} created`);
      setForm(EMPTY);
      onChanged?.();
    } catch (err) {
      setError(err.details ? Object.values(err.details)[0] : err.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggle(promo) {
    setBusyId(String(promo._id));
    setError(null);
    try {
      await updateCode(promo._id, { isActive: !promo.isActive });
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardHeader
          title="New partner campaign"
          subtitle="Flat discount funded by the mall, applied before VAT"
        />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Input label="Code" name="code" value={form.code} onChange={change} placeholder="JAMUNA20" />
          <Input
            label="Partner"
            name="partnerName"
            value={form.partnerName}
            onChange={change}
            placeholder="Jamuna Future Park"
          />
          <Input
            label="Discount (BDT)"
            name="discountTaka"
            type="number"
            min="1"
            value={form.discountTaka}
            onChange={change}
          />
          <Input
            label="Minimum spend (BDT)"
            name="minSpendTaka"
            type="number"
            min="0"
            value={form.minSpendTaka}
            onChange={change}
          />
          <Select
            label="Scope"
            name="propertyType"
            value={form.propertyType}
            onChange={change}
            options={SCOPES}
          />
          <Input
            label="Total uses (blank = unlimited)"
            name="usageLimit"
            type="number"
            min="1"
            value={form.usageLimit}
            onChange={change}
          />
          <Input
            label="Uses per driver"
            name="perUserLimit"
            type="number"
            min="1"
            value={form.perUserLimit}
            onChange={change}
          />
          <Input label="Expires" name="validTo" type="date" value={form.validTo} onChange={change} />

          <div className="sm:col-span-2">
            <Input
              label="Description"
              name="description"
              value={form.description}
              onChange={change}
              placeholder="৳20 off basement parking"
            />
          </div>

          <div className="sm:col-span-2">
            <Button onClick={create} isLoading={creating} disabled={!form.code.trim()}>
              Create campaign
            </Button>
          </div>
        </CardBody>
      </Card>

      {codes.length ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-body">
            <thead className="bg-surface-sunken text-caption text-ink-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Code</th>
                <th className="px-4 py-2 text-left font-medium">Partner</th>
                <th className="px-4 py-2 text-right font-medium">Discount</th>
                <th className="px-4 py-2 text-left font-medium">Scope</th>
                <th className="px-4 py-2 text-right font-medium">Used</th>
                <th className="px-4 py-2 text-left font-medium">Expires</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c._id} className="border-t border-line">
                  <td className="numeric px-4 py-3 font-medium text-ink">{c.code}</td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-ink-muted">
                    {c.partnerName || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money poisha={c.discountPoisha} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-caption font-medium',
                        c.propertyType === PROPERTY_TYPE.MALL
                          ? 'bg-property-mall text-white'
                          : c.propertyType === PROPERTY_TYPE.RESIDENTIAL
                            ? 'bg-property-residential text-white'
                            : 'bg-surface-sunken text-ink-muted'
                      )}
                    >
                      {c.propertyType ? c.propertyType.toLowerCase() : 'any'}
                    </span>
                  </td>
                  <td className="numeric px-4 py-3 text-right text-ink-muted">
                    {c.usedCount}
                    {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                  </td>
                  <td className="px-4 py-3 text-caption text-ink-muted">
                    {c.validTo ? formatDate(c.validTo) : 'No expiry'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant={c.isActive ? 'ghost' : 'outline'}
                      isLoading={busyId === String(c._id)}
                      onClick={() => toggle(c)}
                    >
                      {c.isActive ? 'Disable' : 'Enable'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No promo codes yet"
          description="Create a partner campaign above, or run the promo seed script."
        />
      )}
    </div>
  );
}
