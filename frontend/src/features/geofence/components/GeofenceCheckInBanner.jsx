'use client';
/**
 * GEOFENCE CHECK-IN BANNER — OWNER: S. Moontaha Rahman [SMR]
 * Drops into the booking screen. Watches position, shows the ring, and offers
 * the entry-pass fallback when GPS is unusable.
 */
import { useEffect, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Card, { CardBody } from '@/components/ui/Card';
import { BOOKING_STATUS } from '@/lib/constants';
import useProximityWatcher from '../hooks/useProximityWatcher';
import useMockLocation from '../hooks/useMockLocation';
import { getTarget, manualCheckIn } from '../api/geofence.api';
import ProximityRing from './ProximityRing';
import EntryPassQr from './EntryPassQr';

const CHECKIN_STATES = [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.EN_ROUTE];

export default function GeofenceCheckInBanner({ booking, onCheckedIn }) {
  const [meta, setMeta] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState(null);

  const mock = useMockLocation();
  const active = CHECKIN_STATES.includes(booking?.status);

  useEffect(() => {
    if (!booking?._id) return;
    getTarget(booking._id).then(setMeta).catch(() => setMeta(null));
  }, [booking?._id]);

  const { proximity, isCheckedIn, justCheckedIn, error, permissionDenied, refresh } =
    useProximityWatcher({
      bookingId: booking?._id,
      target: meta?.target,
      active,
      mockCoords: mock.override,
    });

  useEffect(() => {
    if (justCheckedIn) onCheckedIn?.();
  }, [justCheckedIn, onCheckedIn]);

  if (!active && booking?.status !== BOOKING_STATUS.ACTIVE) return null;

  if (booking?.status === BOOKING_STATUS.ACTIVE || isCheckedIn) {
    return (
      <Alert tone="success">
        <span className="font-medium">Checked in.</span> Your session is active
        {booking?.checkIn?.method === 'QR_PASS' && ' — verified with your entry pass'}
        {booking?.checkIn?.method === 'MANUAL' && ' — checked in manually'}.
      </Alert>
    );
  }

  async function checkInManually() {
    setManualBusy(true);
    setManualError(null);
    try {
      await manualCheckIn(booking._id, mock.override || {});
      onCheckedIn?.();
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-4">
        <div className="text-center">
          <p className="text-h3 text-ink">Arriving at {meta?.property?.title || 'the space'}</p>
          <p className="mt-0.5 text-caption text-ink-muted">
            We check you in automatically when you reach the entrance.
          </p>
        </div>

        {!proximity && !error && <Spinner label="Finding your location" />}

        {proximity && (
          <ProximityRing
            distanceMeters={proximity.distanceMeters}
            radiusM={proximity.radiusM || meta?.radiusM}
            isInside={proximity.isInside}
            isCheckedIn={isCheckedIn}
          />
        )}

        {proximity?.reason && !isCheckedIn && (
          <Alert tone={proximity.isInside ? 'warning' : 'info'} className="w-full">
            {proximity.reason}
          </Alert>
        )}

        {error && (
          <Alert tone={permissionDenied ? 'warning' : 'danger'} className="w-full">
            {error}
          </Alert>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            Check again
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowPass((s) => !s)}>
            {showPass ? 'Hide entry pass' : 'Use entry pass'}
          </Button>
          {(permissionDenied || proximity?.isInside === false) && (
            <Button variant="ghost" size="sm" onClick={checkInManually} isLoading={manualBusy}>
              Check in manually
            </Button>
          )}
        </div>

        {manualError && <Alert tone="danger" className="w-full">{manualError}</Alert>}

        {showPass && <EntryPassQr bookingId={booking._id} />}

        {/* Development-only distance simulator. */}
        {mock.enabled && meta?.target && (
          <div className="w-full rounded border border-dashed border-line bg-surface-sunken p-3">
            <p className="text-caption font-medium text-ink-muted">
              Simulate distance (development only)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[200, 50, 20, 8, 0].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => mock.simulateDistance(meta.target, m)}
                  className="numeric rounded-full border border-line px-2.5 py-1 text-caption text-ink-muted hover:border-brand-primary hover:text-ink-brand"
                >
                  {m} m
                </button>
              ))}
              <button
                type="button"
                onClick={mock.clear}
                className="rounded-full border border-line px-2.5 py-1 text-caption text-ink-muted"
              >
                Use real GPS
              </button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
