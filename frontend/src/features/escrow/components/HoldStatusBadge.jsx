'use client';
/**
 * ESCROW HOLD BADGE — OWNER: Tamal Deb Nath [TDN]
 * Mirrors the shared <StatusBadge /> pattern, but for escrow state rather than
 * booking state. Colour is never the only signal — every chip has a label.
 */
import { cn } from '@/lib/formatters';

const STYLES = {
  NONE: { className: 'bg-surface-sunken text-ink-muted', label: 'Not paid' },
  HELD: { className: 'bg-escrow-held text-white', label: 'Funds held' },
  RELEASED: { className: 'bg-escrow-released text-white', label: 'Released to host' },
  REFUNDED: { className: 'bg-info-subtle text-info-fg', label: 'Refunded' },
  PARTIAL_REFUND: { className: 'bg-info-subtle text-info-fg', label: 'Partly refunded' },
  FAILED: { className: 'bg-danger text-white', label: 'Payment failed' },
};

export default function HoldStatusBadge({ status, className }) {
  const style = STYLES[status] || STYLES.NONE;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-caption font-medium',
        style.className,
        className
      )}
    >
      {style.label}
    </span>
  );
}
