/**
 * 🔒 Shared text input with label + error. Errors say what to fix, not sorry.
 */
import { cn } from '@/lib/formatters';

export default function Input({ label, error, hint, id, className, ...props }) {
  const inputId = id || props.name;
  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-caption font-medium text-ink">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={cn(
          'h-10 w-full rounded border bg-surface px-3 text-body text-ink',
          'placeholder:text-ink-subtle',
          'transition-colors duration-fast',
          error ? 'border-danger' : 'border-line hover:border-line-strong',
          className
        )}
        {...props}
      />
      {error ? (
        <span id={`${inputId}-error`} className="text-caption text-danger-fg">
          {error}
        </span>
      ) : (
        hint && <span className="text-caption text-ink-muted">{hint}</span>
      )}
    </div>
  );
}
