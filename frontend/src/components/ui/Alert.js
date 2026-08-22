/** 🔒 Inline feedback. Errors explain what happened and how to fix it. */
import { cn } from '@/lib/formatters';

const TONES = {
  info: 'bg-info-subtle text-info-fg border-info/30',
  success: 'bg-success-subtle text-success-fg border-success/30',
  warning: 'bg-warning-subtle text-warning-fg border-warning/30',
  danger: 'bg-danger-subtle text-danger-fg border-danger/30',
};

export default function Alert({ tone = 'info', title, children, className }) {
  return (
    <div role="alert" className={cn('rounded border px-4 py-3 text-body', TONES[tone], className)}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? 'mt-1' : undefined}>{children}</div>}
    </div>
  );
}
