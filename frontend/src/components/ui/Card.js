/** 🔒 Shared surface container. */
import { cn } from '@/lib/formatters';

export default function Card({ className, children, inverse = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-lg border shadow-1',
        inverse ? 'border-brand-secondary-soft bg-surface-inverse text-ink-inverse' : 'border-line bg-surface-raised',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h3 className="text-h3">{title}</h3>
        {subtitle && <p className="mt-0.5 text-caption text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}
