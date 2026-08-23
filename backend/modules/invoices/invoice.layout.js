/**
 * INVOICE LAYOUT — OWNER: Gourob Gupta [GG]
 * Page geometry and brand constants for the PDF renderer.
 *
 * Colours come from THEME_HEX in shared/constants.js, because PDFKit needs
 * literal hex values and cannot read the CSS variables the web app uses. This
 * is the one sanctioned place hex appears — keeping it here means the invoice
 * and the web UI cannot drift apart.
 */
const { THEME_HEX } = require('../../shared/constants');

const LAYOUT = {
  size: 'A4',
  margin: 48,
  page: { width: 595.28, height: 841.89 },

  colors: {
    brand: THEME_HEX.brandPrimary,
    ink: THEME_HEX.ink,
    inkMuted: THEME_HEX.inkMuted,
    line: THEME_HEX.line,
    surfaceSunken: THEME_HEX.surfaceSunken,
    danger: THEME_HEX.danger,
    accent: THEME_HEX.brandAccent,
  },

  fonts: {
    // PDFKit's built-in cores — no font files to ship, no licensing questions.
    heading: 'Helvetica-Bold',
    body: 'Helvetica',
    mono: 'Courier',
  },

  sizes: { title: 22, heading: 12, body: 9.5, caption: 8, total: 14 },

  columns: {
    description: 48,
    detail: 250,
    amount: 430,
    amountWidth: 117,
  },
};

/** Human labels for the line codes stored on the invoice. */
const LINE_LABELS = {
  PARKING: 'Parking fee',
  ENERGY: 'Electricity (BERC tariff)',
  DISCOUNT: 'Promotional discount',
  VAT: 'VAT',
  FEE: 'Payment processing fee',
};

module.exports = { LAYOUT, LINE_LABELS };
