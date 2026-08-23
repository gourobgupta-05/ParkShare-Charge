'use client';
/**
 * BOOKING DETAIL — assembled by Gourob Gupta [GG]
 * Shows the slot-lock countdown, fare breakdown and the escrow payment panel
 * imported read-only from [TDN]. Other members' session panels slot in here
 * later without touching the [GG]-owned pieces.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card, { CardHeader, CardBody } from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';
import { BOOKING_STATUS } from '@/lib/constants';
import { formatDateTime, formatDuration } from '@/lib/formatters';

import SlotLockNotice from '@/features/calendar/components/SlotLockNotice';
import FareBreakdown from '@/features/tariff/components/FareBreakdown';
import DownloadInvoiceButton from '@/features/invoices/components/DownloadInvoiceButton';
import EscrowPaymentPanel from '@/features/escrow/components/EscrowPaymentPanel';
import { getBooking, cancelBooking } from '@/features/calendar/api/calendar.api';
import { priceBooking } from '@/features/tariff/api/tariff.api';

function BookingScreen() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setIsLoading(true);
    getBooking(id)
      .then(setBooking)
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(load, [load]);

  // An unpaid booking with no price yet needs one before escrow can charge it.
  useEffect(() => {
    if (!booking) return;
    if (booking.status !== BOOKING_STATUS.PENDING_PAYMENT) return;
    if (booking.pricing?.totalPoisha > 0) return;

    priceBooking(booking._id)
      .then((data) => setBooking((b) => ({ ...b, pricing: data.pricing })))
      .catch(() => {}); // the payment panel surfaces the problem if it persists
  }, [booking?._id, booking?.status, booking?.pricing?.totalPoisha]);

  async function cancel() {
    setBusy(true);
    try {
      await cancelBooking(id);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return <main className="flex min-h-[60vh] items-center justify-center"><Spinner label="Loading booking" /></main>;
  }
  if (error && !booking) {
    return <main className="mx-auto w-full max-w-2xl px-4 py-10"><Alert tone="danger">{error}</Alert></main>;
  }
  if (!booking) return null;

  const minutes = Math.round((new Date(booking.endAt) - new Date(booking.startAt)) / 60000);
  const isUnpaid = booking.status === BOOKING_STATUS.PENDING_PAYMENT;
  const isFinished = [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.OVERSTAY].includes(booking.status);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <Link href="/bookings" className="text-caption text-ink-muted underline hover:text-ink">
        ← All bookings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h1">{booking.propertyId?.title || 'Booking'}</h1>
          <p className="numeric mt-1 text-body text-ink-muted">
            {formatDateTime(booking.startAt)} · {formatDuration(minutes)}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <SlotLockNotice createdAt={booking.createdAt} status={booking.status} />

      {booking.pricing?.totalPoisha > 0 && (
        <Card>
          <CardHeader title="Fare" subtitle="Electricity priced against BERC time-of-use rates" />
          <CardBody>
            <FareBreakdown
              breakdown={{
                ...booking.pricing,
                vatRate: 0.15,
                durationMinutes: minutes,
                estimatedKwh: booking.pricing.estimatedKwh,
              }}
              showPeriods={false}
            />
          </CardBody>
        </Card>
      )}

      {isUnpaid && <EscrowPaymentPanel booking={booking} onPaid={load} />}

      {isFinished && (
        <Card>
          <CardHeader title="Invoice" subtitle="Full VAT breakdown, issued once the session completes" />
          <CardBody className="flex flex-wrap items-center gap-3">
            <DownloadInvoiceButton bookingId={booking._id} />
            <Link href={`/bookings/${booking._id}/invoice`}>
              <Button variant="ghost" size="md">View invoice</Button>
            </Link>
            {!booking.reviewId && (
              <Link href={`/review/${booking._id}`}>
                <Button variant="outline" size="md">Leave a review</Button>
              </Link>
            )}
          </CardBody>
        </Card>
      )}

      {isUnpaid && (
        <Button variant="ghost" onClick={cancel} isLoading={busy} className="self-start">
          Cancel and release the slot
        </Button>
      )}
    </main>
  );
}

export default function BookingDetailPage() {
  return (
    <ProtectedRoute>
      <BookingScreen />
    </ProtectedRoute>
  );
}
