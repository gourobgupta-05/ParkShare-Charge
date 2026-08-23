'use client';
/**
 * ADMIN AUDIT TABLE — OWNER: S. Moontaha Rahman [SMR]
 * The review queue. Rejection requires a reason, because "rejected" with no
 * explanation just produces a resubmission of the same documents.
 */
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import Card, { CardBody } from '@/components/ui/Card';
import { formatDateTime, cn } from '@/lib/formatters';
import { adminApprove, adminReject } from '../api/hostVerification.api';

const STATUS_STYLES = {
  SUBMITTED: 'bg-info text-white',
  UNDER_REVIEW: 'bg-warning text-white',
  APPROVED: 'bg-brand-primary text-white',
  REJECTED: 'bg-danger text-white',
  DRAFT: 'bg-surface-sunken text-ink-muted',
};

function ReviewCard({ submission, onChanged }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const host = submission.hostId || {};
  const v = submission;

  async function approve() {
    setBusy('approve');
    setError(null);
    try {
      await adminApprove(v._id);
      onChanged?.();
    } catch (err) {
      setError(err.details?.checklist ? `Incomplete: ${err.details.checklist.join(', ')}` : err.message);
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy('reject');
    setError(null);
    try {
      await adminReject(v._id, reason);
      setRejecting(false);
      setReason('');
      onChanged?.();
    } catch (err) {
      setError(err.details?.reason || err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-h3 text-ink">{host.businessName || host.name || 'Host'}</p>
            <p className="text-caption text-ink-muted">
              {host.email} · {v.propertyType?.toLowerCase()}
            </p>
            {v.submittedAt && (
              <p className="numeric text-caption text-ink-subtle">
                Submitted {formatDateTime(v.submittedAt)}
              </p>
            )}
          </div>
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-caption font-medium',
              STATUS_STYLES[v.status] || STATUS_STYLES.DRAFT
            )}
          >
            {v.status.replace(/_/g, ' ').toLowerCase()}
          </span>
        </div>

        <div className="grid gap-2 rounded bg-surface-sunken p-3 sm:grid-cols-2">
          <div>
            <p className="text-overline uppercase text-ink-muted">NID</p>
            <p className="numeric text-caption text-ink">{v.nid?.number || '—'}</p>
            <p className="text-caption text-ink-muted">{v.nid?.fullName || '—'}</p>
          </div>
          <div>
            <p className="text-overline uppercase text-ink-muted">Charger</p>
            {v.chargerMetrics?.hasCharger ? (
              <p className="numeric text-caption text-ink">
                {v.chargerMetrics.ratedKw} kW · {v.chargerMetrics.connectorType?.replace(/_/g, ' ')}
                {v.chargerMetrics.hasEarthing && v.chargerMetrics.hasRccb ? ' · safety declared' : ' · SAFETY NOT DECLARED'}
              </p>
            ) : (
              <p className="text-caption text-ink-muted">Parking only</p>
            )}
          </div>
        </div>

        {v.documents?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {v.documents.map((d) => (
              <a
                key={d.kind}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-line px-2.5 py-1 text-caption text-ink-brand underline"
              >
                {d.kind.replace(/_/g, ' ').toLowerCase()}
              </a>
            ))}
          </div>
        )}

        {v.checklist && !v.checklist.complete && (
          <Alert tone="warning">
            Missing: {v.checklist.items.filter((i) => !i.done).map((i) => i.label).join(', ')}
          </Alert>
        )}

        {error && <Alert tone="danger">{error}</Alert>}

        {rejecting ? (
          <div className="flex flex-col gap-2">
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What does the host need to fix?"
              className="w-full rounded border border-line bg-surface px-3 py-2 text-caption text-ink placeholder:text-ink-subtle"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="danger" onClick={reject} isLoading={busy === 'reject'} disabled={reason.trim().length < 10}>
                Send back
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" onClick={approve} isLoading={busy === 'approve'}>
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
              Reject
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function AdminAuditTable({ submissions = [], onChanged }) {
  if (!submissions.length) {
    return <EmptyState title="Queue is clear" description="No host submissions are waiting for review." />;
  }

  return (
    <div className="flex flex-col gap-4">
      {submissions.map((s) => (
        <ReviewCard key={s._id} submission={s} onChanged={onChanged} />
      ))}
    </div>
  );
}
