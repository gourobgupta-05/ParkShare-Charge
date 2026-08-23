/**
 * ============================================================================
 * PDF RENDERER — OWNER: Gourob Gupta [GG]
 * ============================================================================
 * Streams an A4 invoice with a full VAT breakdown.
 *
 * PDFKit, not Puppeteer. Headless Chromium needs ~300 MB of RAM and a bundle
 * of system libraries; Render's free tier gives 512 MB total. PDFKit is pure
 * JavaScript, starts instantly, and streams straight to the HTTP response so
 * nothing is written to Render's ephemeral disk.
 *
 * The require is lazy and wrapped: if pdfkit is not installed yet, every other
 * route in the app keeps working and this one returns a clear, actionable 503
 * instead of crashing the process at boot.
 * ============================================================================
 */
const { LAYOUT, LINE_LABELS } = require('./invoice.layout');
const { formatPoisha } = require('../../utils/money');
const ApiError = require('../../utils/ApiError');

/** Lazy load so a missing dependency degrades instead of killing the server. */
function loadPdfKit() {
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    return require('pdfkit');
  } catch {
    throw new ApiError(
      503,
      'PDF generation is unavailable because the pdfkit package is not installed. Run: npm install pdfkit --workspace=backend',
      'PDF_ENGINE_MISSING'
    );
  }
}

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Dates on the invoice are printed in Dhaka local time. */
function dhakaDateTime(date) {
  if (!date) return '—';
  const d = new Date(new Date(date).getTime() + DHAKA_OFFSET_MS);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/* ------------------------------------------------------------------------ */
/* Drawing helpers                                                          */
/* ------------------------------------------------------------------------ */

function drawHeader(doc, invoice) {
  const { colors, fonts, sizes, margin } = LAYOUT;

  // Brand bar
  doc.rect(0, 0, LAYOUT.page.width, 6).fill(colors.brand);

  doc
    .fillColor(colors.ink)
    .font(fonts.heading)
    .fontSize(sizes.title)
    .text('ParkShare & Charge', margin, 48);

  doc
    .font(fonts.body)
    .fontSize(sizes.caption)
    .fillColor(colors.inkMuted)
    .text(invoice.issuer?.name || 'ParkShare & Charge Ltd.', margin, 76)
    .text(invoice.issuer?.address || 'Dhaka, Bangladesh');

  if (invoice.issuer?.bin) doc.text(`BIN: ${invoice.issuer.bin}`);

  // Invoice meta, right aligned
  const right = LAYOUT.columns.amount;
  doc
    .font(fonts.heading)
    .fontSize(sizes.heading)
    .fillColor(colors.ink)
    .text('TAX INVOICE', right, 50, { width: LAYOUT.columns.amountWidth, align: 'right' });

  doc
    .font(fonts.mono)
    .fontSize(sizes.caption)
    .fillColor(colors.inkMuted)
    .text(invoice.invoiceNo, right, 68, { width: LAYOUT.columns.amountWidth, align: 'right' })
    .text(dhakaDateTime(invoice.issuedAt), right, 80, { width: LAYOUT.columns.amountWidth, align: 'right' });

  doc.moveTo(margin, 112).lineTo(LAYOUT.page.width - margin, 112).strokeColor(colors.line).lineWidth(1).stroke();
}

function drawParties(doc, invoice) {
  const { colors, fonts, sizes, margin } = LAYOUT;
  const top = 128;

  doc.font(fonts.heading).fontSize(sizes.caption).fillColor(colors.inkMuted).text('BILLED TO', margin, top);
  doc
    .font(fonts.body)
    .fontSize(sizes.body)
    .fillColor(colors.ink)
    .text(invoice.billedTo?.name || '—', margin, top + 14)
    .fillColor(colors.inkMuted)
    .fontSize(sizes.caption)
    .text(invoice.billedTo?.email || '', margin, top + 28)
    .text(invoice.billedTo?.phone || '', margin, top + 39);

  const col2 = 300;
  doc.font(fonts.heading).fontSize(sizes.caption).fillColor(colors.inkMuted).text('SPACE', col2, top);
  doc
    .font(fonts.body)
    .fontSize(sizes.body)
    .fillColor(colors.ink)
    .text(invoice.propertySnapshot?.title || '—', col2, top + 14, { width: 247 })
    .fillColor(colors.inkMuted)
    .fontSize(sizes.caption)
    .text(invoice.propertySnapshot?.address || '', col2, top + 28, { width: 247 })
    .text(
      `${invoice.propertySnapshot?.propertyType === 'MALL' ? 'Commercial mall' : 'Residential'} · Host: ${invoice.propertySnapshot?.hostName || '—'}`,
      col2,
      top + 50,
      { width: 247 }
    );

  // Session window strip
  const stripTop = top + 76;
  doc.rect(margin, stripTop, LAYOUT.page.width - margin * 2, 30).fill(colors.surfaceSunken);
  doc
    .font(fonts.body)
    .fontSize(sizes.caption)
    .fillColor(colors.inkMuted)
    .text(
      `Session: ${dhakaDateTime(invoice.periodStart)}  →  ${dhakaDateTime(invoice.periodEnd)}   (Asia/Dhaka)` +
        (invoice.totalKwh ? `      Energy metered: ${invoice.totalKwh.toFixed(2)} kWh` : '') +
        (invoice.tariffVersion ? `      BERC rates: ${invoice.tariffVersion}` : ''),
      margin + 10,
      stripTop + 11
    );

  return stripTop + 48;
}

function drawTable(doc, invoice, startY) {
  const { colors, fonts, sizes, columns, margin } = LAYOUT;
  let y = startY;

  // Header row
  doc.font(fonts.heading).fontSize(sizes.caption).fillColor(colors.inkMuted);
  doc.text('DESCRIPTION', columns.description, y);
  doc.text('DETAIL', columns.detail, y);
  doc.text('AMOUNT', columns.amount, y, { width: columns.amountWidth, align: 'right' });

  y += 14;
  doc.moveTo(margin, y).lineTo(LAYOUT.page.width - margin, y).strokeColor(colors.line).stroke();
  y += 10;

  const subtotalLines = invoice.lines.filter((l) => l.code !== 'VAT' && l.code !== 'FEE');
  const taxLines = invoice.lines.filter((l) => l.code === 'VAT' || l.code === 'FEE');

  const renderLine = (line) => {
    const isDiscount = line.code === 'DISCOUNT';
    doc.font(fonts.body).fontSize(sizes.body).fillColor(colors.ink);
    doc.text(line.description || LINE_LABELS[line.code] || line.code, columns.description, y, { width: 195 });

    if (line.detail) {
      doc.font(fonts.body).fontSize(sizes.caption).fillColor(colors.inkMuted);
      doc.text(line.detail, columns.detail, y + 1, { width: 175 });
    }

    doc.font(fonts.mono).fontSize(sizes.body).fillColor(isDiscount ? colors.brand : colors.ink);
    doc.text(
      `${isDiscount ? '-' : ''}${formatPoisha(Math.abs(line.amountPoisha))}`,
      columns.amount,
      y,
      { width: columns.amountWidth, align: 'right' }
    );

    y += Math.max(18, doc.heightOfString(line.detail || '', { width: 175 }) + 6);
  };

  subtotalLines.forEach(renderLine);

  // Subtotal
  y += 4;
  doc.moveTo(columns.detail, y).lineTo(LAYOUT.page.width - margin, y).strokeColor(colors.line).stroke();
  y += 8;

  const netPoisha =
    invoice.basePoisha + invoice.energyPoisha - invoice.discountPoisha;

  doc.font(fonts.body).fontSize(sizes.body).fillColor(colors.inkMuted);
  doc.text('Taxable amount', columns.detail, y);
  doc.font(fonts.mono).fillColor(colors.ink);
  doc.text(formatPoisha(netPoisha), columns.amount, y, { width: columns.amountWidth, align: 'right' });
  y += 18;

  taxLines.forEach(renderLine);

  // Total block
  y += 6;
  doc.rect(columns.detail - 10, y, LAYOUT.page.width - margin - columns.detail + 10, 36).fill(colors.surfaceSunken);
  doc.font(fonts.heading).fontSize(sizes.heading).fillColor(colors.ink);
  doc.text('TOTAL PAID', columns.detail, y + 12);
  doc.font(fonts.mono).fontSize(sizes.total).fillColor(colors.brand);
  doc.text(formatPoisha(invoice.totalPoisha), columns.amount, y + 10, {
    width: columns.amountWidth,
    align: 'right',
  });

  return y + 52;
}

function drawEnergyBreakdown(doc, breakdown, startY) {
  if (!breakdown?.periods?.length) return startY;

  const { colors, fonts, sizes, margin, columns } = LAYOUT;
  let y = startY;

  doc.font(fonts.heading).fontSize(sizes.caption).fillColor(colors.inkMuted);
  doc.text('ELECTRICITY BREAKDOWN (BERC TIME-OF-USE)', margin, y);
  y += 14;

  doc.font(fonts.body).fontSize(sizes.caption).fillColor(colors.inkMuted);
  doc.text('PERIOD', margin, y);
  doc.text('DURATION', 150, y);
  doc.text('ENERGY', 250, y);
  doc.text('RATE / kWh', 330, y);
  doc.text('AMOUNT', columns.amount, y, { width: columns.amountWidth, align: 'right' });
  y += 12;
  doc.moveTo(margin, y).lineTo(LAYOUT.page.width - margin, y).strokeColor(colors.line).stroke();
  y += 8;

  breakdown.periods.forEach((p) => {
    doc.font(fonts.body).fontSize(sizes.caption).fillColor(colors.ink);
    doc.text(p.period.replace(/_/g, '-'), margin, y);
    doc.font(fonts.mono);
    doc.text(`${p.hours} h`, 150, y);
    doc.text(`${Number(p.kwh).toFixed(2)} kWh`, 250, y);
    doc.text(formatPoisha(p.effectivePoishaPerKwh), 330, y);
    doc.text(formatPoisha(p.linePoisha), columns.amount, y, {
      width: columns.amountWidth,
      align: 'right',
    });
    y += 14;
  });

  return y + 12;
}

function drawFooter(doc, invoice) {
  const { colors, fonts, sizes, margin } = LAYOUT;
  const y = LAYOUT.page.height - 96;

  doc.moveTo(margin, y).lineTo(LAYOUT.page.width - margin, y).strokeColor(colors.line).stroke();

  doc
    .font(fonts.body)
    .fontSize(sizes.caption)
    .fillColor(colors.inkMuted)
    .text(
      `VAT charged at ${(invoice.vatRate * 100).toFixed(0)}% on the taxable amount. ` +
        'Electricity is billed against Bangladesh Energy Regulatory Commission time-of-use rates ' +
        'plus the host\u2019s declared charger overhead.',
      margin,
      y + 12,
      { width: LAYOUT.page.width - margin * 2 }
    )
    .text(
      'This is a computer-generated invoice and needs no signature. Amounts are in Bangladeshi Taka (BDT).',
      margin,
      y + 40,
      { width: LAYOUT.page.width - margin * 2 }
    );
}

/* ------------------------------------------------------------------------ */
/* Public                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Renders the invoice into a writable stream (usually the HTTP response).
 * @param {object} invoice   - Invoice document (lean object is fine)
 * @param {object} [options]
 * @param {object} [options.energyBreakdown] - tariff periods, if available
 * @param {Writable} stream
 */
function renderInvoicePdf(invoice, stream, options = {}) {
  const PDFDocument = loadPdfKit();

  const doc = new PDFDocument({
    size: LAYOUT.size,
    margin: LAYOUT.margin,
    info: {
      Title: `Invoice ${invoice.invoiceNo}`,
      Author: invoice.issuer?.name || 'ParkShare & Charge',
      Subject: 'Parking and EV charging invoice',
    },
  });

  doc.pipe(stream);

  drawHeader(doc, invoice);
  const afterParties = drawParties(doc, invoice);
  const afterTable = drawTable(doc, invoice, afterParties);
  drawEnergyBreakdown(doc, options.energyBreakdown, afterTable);
  drawFooter(doc, invoice);

  doc.end();
  return doc;
}

/** Buffers the PDF instead of streaming — used by tests and email attachments. */
function renderInvoiceBuffer(invoice, options = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const sink = {
      write: (chunk) => chunks.push(chunk),
      end: () => resolve(Buffer.concat(chunks)),
      on: () => {},
      once: () => {},
      emit: () => {},
    };
    try {
      const doc = renderInvoicePdf(invoice, sink, options);
      doc.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { renderInvoicePdf, renderInvoiceBuffer, dhakaDateTime, loadPdfKit };
