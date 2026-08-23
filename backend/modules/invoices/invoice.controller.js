/**
 * INVOICE CONTROLLER — OWNER: Gourob Gupta [GG]
 */
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created } = require('../../utils/apiResponse');
const service = require('./invoice.service');
const { renderInvoicePdf } = require('./pdfRenderer.service');

/** POST /api/invoices/generate/:bookingId */
const generate = asyncHandler(async (req, res) => {
  const { invoice, alreadyExisted } = await service.generateForBooking({
    bookingId: req.params.bookingId,
    actorId: req.userId,
    role: req.user.role,
  });
  const message = alreadyExisted ? 'Invoice already issued' : `Invoice ${invoice.invoiceNo} issued`;
  return alreadyExisted ? ok(res, invoice, message) : created(res, invoice, message);
});

/** GET /api/invoices?scope=driver|host */
const list = asyncHandler(async (req, res) => {
  const scope = ['driver', 'host', 'all'].includes(req.query.scope) ? req.query.scope : 'driver';
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 50);

  const data = await service.listInvoices({ userId: req.userId, role: req.user.role, scope, page, limit });
  return ok(res, data, `${data.total} invoice${data.total === 1 ? '' : 's'}`);
});

/** GET /api/invoices/:id */
const detail = asyncHandler(async (req, res) => {
  const data = await service.getInvoice({
    invoiceId: req.params.id,
    userId: req.userId,
    role: req.user.role,
  });
  return ok(res, data);
});

/**
 * GET /api/invoices/:id/pdf
 * Streams straight to the response — nothing is written to Render's disk,
 * which is ephemeral and would lose the file on the next deploy anyway.
 */
const downloadPdf = asyncHandler(async (req, res) => {
  const { invoice, energyBreakdown } = await service.getInvoice({
    invoiceId: req.params.id,
    userId: req.userId,
    role: req.user.role,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNo}.pdf"`);
  res.setHeader('Cache-Control', 'private, max-age=0, no-cache');

  renderInvoicePdf(invoice, res, { energyBreakdown });
});

module.exports = { generate, list, detail, downloadPdf };
