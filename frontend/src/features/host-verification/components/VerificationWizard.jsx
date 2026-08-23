'use client';
/**
 * VERIFICATION WIZARD — OWNER: S. Moontaha Rahman [SMR]
 * NID details, ownership proof, charger safety metrics, then submit.
 * The checklist comes from the server so the two can never disagree.
 */
import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import { PROPERTY_TYPE, CONNECTOR_TYPE, VERIFICATION_STATUS } from '@/lib/constants';
import { cn } from '@/lib/formatters';
import { getMine, saveDraft, submit } from '../api/hostVerification.api';
import DocUploader from './DocUploader';

const CONNECTORS = [
  { value: '', label: 'Select connector' },
  ...Object.values(CONNECTOR_TYPE).map((v) => ({ value: v, label: v.replace(/_/g, ' ') })),
];

const OWNERSHIP_TYPES = [
  { value: '', label: 'Select document' },
  { value: 'DEED', label: 'Property deed' },
  { value: 'UTILITY_BILL', label: 'Utility bill' },
  { value: 'TENANCY_AGREEMENT', label: 'Tenancy agreement' },
  { value: 'TRADE_LICENCE', label: 'Trade licence' },
];

const STATUS_TONE = {
  [VERIFICATION_STATUS.APPROVED]: 'success',
  [VERIFICATION_STATUS.REJECTED]: 'danger',
  [VERIFICATION_STATUS.SUBMITTED]: 'info',
  [VERIFICATION_STATUS.UNDER_REVIEW]: 'info',
};

export default function VerificationWizard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    nidNumber: '', fullName: '', dateOfBirth: '',
    ownershipType: '', referenceNo: '',
    hasCharger: false, ratedKw: '', connectorType: '', phase: 'SINGLE',
    hasEarthing: false, hasRccb: false, overheadTaka: '1.50',
  });

  const load = useCallback(() => {
    setIsLoading(true);
    getMine()
      .then((d) => {
        setData(d);
        const v = d.verification;
        setForm((f) => ({
          ...f,
          nidNumber: v.nid?.number || '',
          fullName: v.nid?.fullName || '',
          dateOfBirth: v.nid?.dateOfBirth ? String(v.nid.dateOfBirth).slice(0, 10) : '',
          ownershipType: v.ownership?.documentType || '',
          referenceNo: v.ownership?.referenceNo || '',
          hasCharger: Boolean(v.chargerMetrics?.hasCharger),
          ratedKw: v.chargerMetrics?.ratedKw ?? '',
          connectorType: v.chargerMetrics?.connectorType || '',
          phase: v.chargerMetrics?.phase || 'SINGLE',
          hasEarthing: Boolean(v.chargerMetrics?.hasEarthing),
          hasRccb: Boolean(v.chargerMetrics?.hasRccb),
          overheadTaka: ((v.chargerMetrics?.overheadPoishaPerKwh ?? 150) / 100).toFixed(2),
        }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  if (isLoading) return <div className="py-10"><Spinner label="Loading your verification" /></div>;
  if (!data) return <Alert tone="danger">{error || 'Could not load your verification'}</Alert>;

  const { verification, checklist, canEdit } = data;
  const isMall = verification.propertyType === PROPERTY_TYPE.MALL;
  const docOf = (kind) => verification.documents?.find((d) => d.kind === kind);

  async function save() {
    setBusy('save');
    setError(null);
    setMessage(null);
    try {
      await saveDraft({
        nid: {
          number: form.nidNumber,
          fullName: form.fullName,
          ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
        },
        ownership: { documentType: form.ownershipType || null, referenceNo: form.referenceNo },
        chargerMetrics: {
          hasCharger: form.hasCharger,
          ratedKw: form.ratedKw ? Number(form.ratedKw) : undefined,
          connectorType: form.connectorType || undefined,
          phase: form.phase,
          hasEarthing: form.hasEarthing,
          hasRccb: form.hasRccb,
          overheadPoishaPerKwh: Math.round(Number(form.overheadTaka || 0) * 100),
        },
      });
      setMessage('Saved');
      load();
    } catch (err) {
      setError(err.details ? Object.values(err.details)[0] : err.message);
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setBusy('submit');
    setError(null);
    try {
      await submit();
      setMessage('Submitted — we will review your documents shortly');
      load();
    } catch (err) {
      setError(err.details?.checklist ? `Still needed: ${err.details.checklist.join(', ')}` : err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Alert tone={STATUS_TONE[verification.status] || 'info'}>
        <span className="font-medium">{verification.status.replace(/_/g, ' ').toLowerCase()}</span>
        {verification.status === VERIFICATION_STATUS.REJECTED && verification.rejectionReason && (
          <p className="mt-1">{verification.rejectionReason}</p>
        )}
        {verification.status === VERIFICATION_STATUS.APPROVED && (
          <p className="mt-1">You can publish your spaces and start taking bookings.</p>
        )}
      </Alert>

      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}

      {/* progress */}
      <Card>
        <CardHeader
          title="Your checklist"
          subtitle={checklist.complete ? 'Everything is in place' : `${checklist.remaining} item${checklist.remaining === 1 ? '' : 's'} left`}
        />
        <CardBody className="flex flex-col gap-1.5">
          {checklist.items.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full text-caption text-white',
                  item.done ? 'bg-brand-primary' : 'bg-line'
                )}
                aria-hidden="true"
              >
                {item.done ? '✓' : ''}
              </span>
              <span className={cn('text-body', item.done ? 'text-ink-muted line-through' : 'text-ink')}>
                {item.label}
              </span>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* identity */}
      <Card>
        <CardHeader title="Identity" subtitle="Your NID as it appears on the card" />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Input
            label="NID number"
            value={form.nidNumber}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, nidNumber: e.target.value }))}
            hint="10, 13 or 17 digits"
          />
          <Input
            label="Full name on NID"
            value={form.fullName}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
          <Input
            label="Date of birth"
            type="date"
            value={form.dateOfBirth}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
          />
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <DocUploader kind="NID_FRONT" label="NID front" existing={docOf('NID_FRONT')} disabled={!canEdit} onUploaded={load} />
            <DocUploader kind="NID_BACK" label="NID back" existing={docOf('NID_BACK')} disabled={!canEdit} onUploaded={load} />
          </div>
        </CardBody>
      </Card>

      {/* ownership */}
      <Card>
        <CardHeader
          title={isMall ? 'Business documents' : 'Proof you control the space'}
          subtitle={isMall ? 'Trade licence for the mall' : 'A deed, tenancy agreement or recent utility bill'}
        />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Document type"
            value={form.ownershipType}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, ownershipType: e.target.value }))}
            options={OWNERSHIP_TYPES}
          />
          <Input
            label="Reference number"
            value={form.referenceNo}
            disabled={!canEdit}
            onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))}
          />
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            <DocUploader
              kind={isMall ? 'TRADE_LICENCE' : 'OWNERSHIP_PROOF'}
              label={isMall ? 'Trade licence' : 'Ownership proof'}
              existing={docOf(isMall ? 'TRADE_LICENCE' : 'OWNERSHIP_PROOF')}
              disabled={!canEdit}
              onUploaded={load}
            />
            <DocUploader
              kind="SPACE_PHOTO"
              label="Photo of the space"
              hint="Show the parking bay and its entrance"
              existing={docOf('SPACE_PHOTO')}
              disabled={!canEdit}
              onUploaded={load}
            />
          </div>
        </CardBody>
      </Card>

      {/* charger */}
      <Card>
        <CardHeader title="EV charger" subtitle="Only if you offer charging" />
        <CardBody className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-primary"
              checked={form.hasCharger}
              disabled={!canEdit}
              onChange={(e) => setForm((f) => ({ ...f, hasCharger: e.target.checked }))}
            />
            <span className="text-body text-ink">This space has an EV charger</span>
          </label>

          {form.hasCharger && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Rated power (kW)"
                  type="number"
                  value={form.ratedKw}
                  disabled={!canEdit}
                  onChange={(e) => setForm((f) => ({ ...f, ratedKw: e.target.value }))}
                />
                <Select
                  label="Connector"
                  value={form.connectorType}
                  disabled={!canEdit}
                  onChange={(e) => setForm((f) => ({ ...f, connectorType: e.target.value }))}
                  options={CONNECTORS}
                />
                <Select
                  label="Supply"
                  value={form.phase}
                  disabled={!canEdit}
                  onChange={(e) => setForm((f) => ({ ...f, phase: e.target.value }))}
                  options={[
                    { value: 'SINGLE', label: 'Single phase' },
                    { value: 'THREE', label: 'Three phase' },
                  ]}
                />
                <Input
                  label="Your overhead (৳ per kWh)"
                  type="number"
                  step="0.10"
                  value={form.overheadTaka}
                  disabled={!canEdit}
                  onChange={(e) => setForm((f) => ({ ...f, overheadTaka: e.target.value }))}
                  hint="Added on top of the BERC rate"
                />
              </div>

              <div className="rounded border border-warning/30 bg-warning-subtle p-3">
                <p className="text-caption font-medium text-warning-fg">Safety declaration</p>
                <label className="mt-2 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-primary"
                    checked={form.hasEarthing}
                    disabled={!canEdit}
                    onChange={(e) => setForm((f) => ({ ...f, hasEarthing: e.target.checked }))}
                  />
                  <span className="text-caption text-ink">The circuit is properly earthed</span>
                </label>
                <label className="mt-1 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-primary"
                    checked={form.hasRccb}
                    disabled={!canEdit}
                    onChange={(e) => setForm((f) => ({ ...f, hasRccb: e.target.checked }))}
                  />
                  <span className="text-caption text-ink">An RCCB or RCD protects the circuit</span>
                </label>
              </div>

              <DocUploader
                kind="ELECTRICAL_CERT"
                label="Electrical certificate (optional)"
                hint="Speeds up review if you have one"
                existing={docOf('ELECTRICAL_CERT')}
                disabled={!canEdit}
                onUploaded={load}
              />
            </>
          )}
        </CardBody>
      </Card>

      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={save} isLoading={busy === 'save'}>
            Save progress
          </Button>
          <Button onClick={send} isLoading={busy === 'submit'} disabled={!checklist.complete}>
            Submit for review
          </Button>
        </div>
      )}
    </div>
  );
}
