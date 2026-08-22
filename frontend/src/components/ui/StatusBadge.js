/**
 * 🔒 THE booking status chip — DO NOT EDIT, DO NOT REIMPLEMENT.
 * All four members render booking state through this component so the "Active"
 * chip looks identical on the map, the session screen and the host dashboard.
 *
 * Colour is never the only signal: every chip carries its text label.
 * ACTIVE is the ONLY status that pulses (the signature element).
 */
import { BOOKING_STATUS_THEME } from '@/lib/constants';
import { cn } from '@/lib/formatters';

const TOKEN_STYLES = {
  primary: 'bg-brand-primary text-white',
  accent: 'bg-brand-accent text-white',
  info: 'bg-info text-white',
  warning: 'bg-warning text-white',
  danger: 'bg-danger text-white',
  'danger-outline': 'border border-danger text-danger-fg bg-danger-subtle',
  'success-subtle': 'bg-success-subtle text-success-fg',
  muted: 'bg-surface-sunken text-ink-muted',
};

export default function StatusBadge({ status, className }) {
  const theme = BOOKING_STATUS_THEME[status];
  if (!theme) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium',
        TOKEN_STYLES[theme.token] || TOKEN_STYLES.muted,
        theme.pulse && 'animate-charge-pulse',
        className
      )}
    >
      {theme.pulse && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {theme.label}
    </span>
  );
}
