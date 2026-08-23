/**
 * 🔒 Shared button. Use this everywhere instead of styling a <button>.
 * Variants carry meaning: primary = the main action, danger = destructive.
 */
import { cn } from '@/lib/formatters';

const VARIANTS = {
  primary: 'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-1',
  secondary: 'bg-surface-inverse text-ink-inverse hover:bg-brand-secondary-soft',
  outline: 'border border-line-strong bg-surface text-ink hover:bg-surface-sunken',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
  accent: 'bg-brand-accent text-white hover:opacity-90',
};

const SIZES = {
  sm: 'h-8 px-3 text-caption',
  md: 'h-10 px-4 text-body',
  lg: 'h-12 px-6 text-body',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded font-medium',
        'transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
