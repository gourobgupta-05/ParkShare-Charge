/** 🔒 Shared loading indicator. */
export default function Spinner({ label = null, size = 'md' }) {
  const dims = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-9 w-9' }[size];
  return (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <span className={`${dims} animate-spin rounded-full border-2 border-line border-t-brand-primary`} />
      {label && <span className="text-caption text-ink-muted">{label}</span>}
    </div>
  );
}
