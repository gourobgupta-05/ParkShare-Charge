/** 🔒 Shared select. Same API as Input. */
import { cn } from '@/lib/formatters';

export default function Select({ label, error, options = [], id, className, ...props }) {
  const selectId = id || props.name;
  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-caption font-medium text-ink">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'h-10 w-full rounded border bg-surface px-3 text-body text-ink',
          error ? 'border-danger' : 'border-line hover:border-line-strong',
          className
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="text-caption text-danger-fg">{error}</span>}
    </div>
  );
}
