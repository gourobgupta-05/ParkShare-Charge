/** 🔒 An empty screen is an invitation to act, not an apology. */
export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface-sunken px-6 py-12 text-center">
      <h3 className="text-h3 text-ink">{title}</h3>
      {description && <p className="max-w-sm text-body text-ink-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
