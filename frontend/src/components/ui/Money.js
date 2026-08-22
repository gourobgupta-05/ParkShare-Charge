/**
 * 🔒 Renders a poisha integer as BDT. ALWAYS use this — never format money in
 * a feature component, and never pass a float.
 *   <Money poisha={booking.pricing.totalPoisha} />
 */
import { formatMoney, cn } from '@/lib/formatters';

export default function Money({ poisha, className, emphasis = false }) {
  return (
    <span className={cn('numeric', emphasis && 'font-display font-semibold text-ink', className)}>
      {formatMoney(poisha)}
    </span>
  );
}
