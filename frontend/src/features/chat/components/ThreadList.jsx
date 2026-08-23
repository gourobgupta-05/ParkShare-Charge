'use client';
/**
 * THREAD LIST — OWNER: Maidul Islam [MI]
 * Counterparties are shown by name only — never a phone number or email.
 */
import EmptyState from '@/components/ui/EmptyState';
import { formatDateTime, cn } from '@/lib/formatters';

export default function ThreadList({ threads = [], activeId, onSelect }) {
  if (!threads.length) {
    return (
      <EmptyState
        title="No conversations yet"
        description="A chat opens automatically once a booking is paid for."
      />
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line">
      {threads.map((t) => {
        const isActive = String(t._id) === String(activeId);
        return (
          <li key={t._id}>
            <button
              type="button"
              onClick={() => onSelect?.(t)}
              className={cn(
                'flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors duration-fast',
                isActive ? 'bg-brand-primary-subtle' : 'bg-surface-raised hover:bg-surface-sunken'
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-body font-medium text-ink">{t.counterparty?.name}</p>
                <p className="truncate text-caption text-ink-muted">{t.property?.title || 'Booking'}</p>
                {t.lastMessageAt && (
                  <p className="numeric mt-0.5 text-caption text-ink-subtle">
                    {formatDateTime(t.lastMessageAt)}
                  </p>
                )}
              </div>

              {t.unreadCount > 0 && (
                <span className="numeric shrink-0 rounded-full bg-brand-primary px-2 py-0.5 text-caption font-medium text-white">
                  {t.unreadCount}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
