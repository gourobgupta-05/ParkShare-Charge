/**
 * INVOICE SERVICE — OWNER: Gourob Gupta [GG]
 *
 * Builds the historical record from the Payment document written by [TDN]'s
 * escrow feature, falling back to booking.pricing when a booking was completed
 * without a payment row (seeded demo data, for instance).
 *
 * Invoices are generated once and never recomputed. If a refund happens later,
 * a credit note is the correct answer — silently editing an issued invoice is
 * not, and would be a genuine accounting fault in the report.
 */
const mongoose = require('mongoose');
const { Booking, Payment, Property, User, Session } = require('../../models');
const Invoice = require('./invoice.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { formatPoisha } = require('../../utils/money');
const { BOOKING_STATUS, ROLES, PLATFORM } = require('../../shared/constants');

const SERIES_PREFIX = process.env.INVOICE_SERIES_PREFIX || 'PSC';

/** PSC-2026-000042 — sequential within the calendar year. */
async function nextInvoiceNo(session = null) {
  const year = new Date().getUTCFullYear();
  const prefix = `${SERIES_PREFIX}-${year}-`;

  const query = Invoice.findOne({ invoiceNo: new RegExp(`^${prefix}`) })
    .sort({ invoiceNo: -1 })
    .select('invoiceNo');
  if (session) query.session(session);

  const last = await query.lean();
  const nextSeq = last ? parseInt(String(last.invoiceNo).split('-').pop(), 10) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}

/** Assembles the frozen line items. */
function buildLines({ basePoisha, energyPoisha, discountPoisha, vatPoisha, processingFeePoisha, vatRate, totalKwh, periods }) {
  const lines = [];

  if (basePoisha) {
    lines.push({ code: 'PARKING', description: 'Parking fee', detail: null, amountPoisha: basePoisha });
  }
  if (energyPoisha) {
    const detail = periods?.length
      ? periods.map((p) => `${Number(p.kwh).toFixed(2)} kWh ${p.period.replace(/_/g, '-')}`).join(', ')
      : totalKwh
        ? `${Number(totalKwh).toFixed(2)} kWh metered`
        : null;
    lines.push({ code: 'ENERGY', description: 'Electricity (BERC tariff)', detail, amountPoisha: energyPoisha });
  }
  if (discountPoisha) {
    lines.push({ code: 'DISCOUNT', description: 'Promotional discount', detail: null, amountPoisha: discountPoisha });
  }
  if (vatPoisha) {
    lines.push({
      code: 'VAT',
      description: 'VAT',
      detail: `${(vatRate * 100).toFixed(0)}% of taxable amount`,
      amountPoisha: vatPoisha,
    });
  }
  if (processingFeePoisha) {
    lines.push({
      code: 'FEE',
      description: 'Payment processing fee',
      detail: `${(PLATFORM.PROCESSING_FEE_RATE * 100).toFixed(1)}%`,
      amountPoisha: processingFeePoisha,
    });
  }

  return lines;
}

/**
 * Generates (or returns the existing) invoice for a booking.
 * Idempotent — calling it twice returns the same document rather than issuing
 * a duplicate number.
 */
async function generateForBooking({ bookingId, actorId, role }) {
  if (!mongoose.isValidObjectId(bookingId)) throw ApiError.badRequest('That is not a valid booking id');

  const existing = await Invoice.findOne({ bookingId }).lean();
  if (existing) return { invoice: existing, alreadyExisted: true };

  const booking = await Booking.findById(bookingId).lean();
  if (!booking) throw ApiError.notFound('That booking no longer exists');

  const isParty =
    String(booking.driverId) === String(actorId) || String(booking.hostId) === String(actorId);
  if (!isParty && role !== ROLES.ADMIN) throw ApiError.forbidden('You are not a party to this booking');

  const billable = [BOOKING_STATUS.COMPLETED, BOOKING_STATUS.OVERSTAY, BOOKING_STATUS.DISPUTED];
  if (!billable.includes(booking.status)) {
    throw ApiError.badRequest(
      'An invoice is issued once the session is complete',
      undefined,
      { bookingId: `This booking is ${booking.status.toLowerCase().replace(/_/g, ' ')}` }
    );
  }

  // Prefer the payment snapshot — that is what the driver was actually charged.
  const payment = await Payment.findOne({ bookingId }).lean();
  const source = payment?.breakdown || booking.pricing || {};
  const totalPoisha = payment?.amountPoisha ?? booking.pricing?.totalPoisha ?? 0;

  if (!totalPoisha) {
    throw ApiError.badRequest('This booking has no recorded charge to invoice');
  }

  const [property, driver, host, chargingSession] = await Promise.all([
    Property.findById(booking.propertyId).select('title address propertyType').lean(),
    User.findById(booking.driverId).select('name email phone').lean(),
    User.findById(booking.hostId).select('name businessName').lean(),
    Session.findOne({ bookingId }).select('totalKwh tariffBreakdown').lean(),
  ]);

  const vatRate = PLATFORM.VAT_RATE;
  const periods = chargingSession?.tariffBreakdown?.periods || [];

  const lines = buildLines({
    basePoisha: source.basePoisha || 0,
    energyPoisha: source.energyPoisha || 0,
    discountPoisha: source.discountPoisha || 0,
    vatPoisha: source.vatPoisha || 0,
    processingFeePoisha: source.processingFeePoisha || 0,
    vatRate,
    totalKwh: chargingSession?.totalKwh || booking.pricing?.estimatedKwh || 0,
    periods,
  });

  const addressParts = [property?.address?.line1, property?.address?.area, property?.address?.city]
    .filter(Boolean)
    .join(', ');

  const dbSession = await mongoose.startSession();
  let invoice;

  try {
    await dbSession.withTransaction(async () => {
      const invoiceNo = await nextInvoiceNo(dbSession);
      const [created] = await Invoice.create(
        [
          {
            invoiceNo,
            bookingId: booking._id,
            paymentId: payment?._id || null,
            driverId: booking.driverId,
            hostId: booking.hostId,
            propertyId: booking.propertyId,
            issuedAt: new Date(),
            periodStart: booking.startAt,
            periodEnd: booking.checkOut?.at || booking.endAt,
            lines,
            basePoisha: source.basePoisha || 0,
            energyPoisha: source.energyPoisha || 0,
            discountPoisha: source.discountPoisha || 0,
            vatPoisha: source.vatPoisha || 0,
            processingFeePoisha: source.processingFeePoisha || 0,
            totalPoisha,
            vatRate,
            totalKwh: chargingSession?.totalKwh || 0,
            tariffVersion: chargingSession?.tariffBreakdown?.rateVersion || null,
            issuer: {
              name: process.env.INVOICE_ISSUER_NAME || 'ParkShare & Charge Ltd.',
              address: process.env.INVOICE_ISSUER_ADDRESS || 'Dhaka, Bangladesh',
              bin: process.env.INVOICE_BIN_NUMBER || null,
            },
            billedTo: { name: driver?.name, email: driver?.email, phone: driver?.phone },
            propertySnapshot: {
              title: property?.title,
              address: addressParts,
              propertyType: property?.propertyType,
              hostName: host?.businessName || host?.name,
            },
          },
        ],
        { session: dbSession }
      );
      invoice = created;
    });
  } catch (err) {
    if (err.code === 11000) {
      const raced = await Invoice.findOne({ bookingId }).lean();
      if (raced) return { invoice: raced, alreadyExisted: true };
    }
    throw err;
  } finally {
    await dbSession.endSession();
  }

  logger.info(`[invoices] issued ${invoice.invoiceNo} for ${formatPoisha(invoice.totalPoisha)}`);
  return { invoice: invoice.toObject ? invoice.toObject() : invoice, alreadyExisted: false };
}

async function listInvoices({ userId, role, scope = 'driver', page = 1, limit = 20 }) {
  const match = scope === 'host' ? { hostId: userId } : { driverId: userId };
  if (role === ROLES.ADMIN && scope === 'all') {
    delete match.hostId;
    delete match.driverId;
  }

  const [items, total, totals] = await Promise.all([
    Invoice.find(match)
      .sort({ issuedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(match),
    Invoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalPoisha: { $sum: '$totalPoisha' },
          vatPoisha: { $sum: '$vatPoisha' },
          energyPoisha: { $sum: '$energyPoisha' },
          totalKwh: { $sum: '$totalKwh' },
        },
      },
    ]),
  ]);

  return {
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
    totals: totals[0] || { totalPoisha: 0, vatPoisha: 0, energyPoisha: 0, totalKwh: 0 },
  };
}

async function getInvoice({ invoiceId, userId, role }) {
  if (!mongoose.isValidObjectId(invoiceId)) throw ApiError.badRequest('That is not a valid invoice id');

  const invoice = await Invoice.findById(invoiceId).lean();
  if (!invoice) throw ApiError.notFound('That invoice no longer exists');

  const isParty =
    String(invoice.driverId) === String(userId) || String(invoice.hostId) === String(userId);
  if (!isParty && role !== ROLES.ADMIN) throw ApiError.forbidden('This invoice is not yours');

  const session = await Session.findOne({ bookingId: invoice.bookingId })
    .select('tariffBreakdown totalKwh')
    .lean();

  return { invoice, energyBreakdown: session?.tariffBreakdown || null };
}

module.exports = { generateForBooking, listInvoices, getInvoice, nextInvoiceNo, buildLines };
