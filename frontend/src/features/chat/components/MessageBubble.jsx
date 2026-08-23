'use client';
/**
 * MESSAGE BUBBLE — OWNER: Maidul Islam [MI]
 * A redacted message is labelled rather than silently altered — the sender
 * should know their number was stripped, not wonder why it vanished.
 */
import { cn } from '@/lib/formatters';

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MessageBubble({ message }) {
  const mine = Boolean(message.isMine);

  return (
    <div className={cn('flex w-full', mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex max-w-[78%] flex-col', mine ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-body',
            mine
              ? 'rounded-br-sm bg-brand-primary text-white'
              : 'rounded-bl-sm border border-line bg-surface-raised text-ink',
            message.isPending && 'opacity-60'
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 px-1">
          <span className="numeric text-caption text-ink-subtle">
            {message.isPending ? 'sending…' : timeLabel(message.createdAt)}
          </span>
          {mine && message.readAt && !message.isPending && (
            <span className="text-caption text-ink-subtle">· read</span>
          )}
          {message.wasRedacted && (
            <span
              className="rounded-full bg-warning-subtle px-1.5 text-caption text-warning-fg"
              title="Contact details are hidden to keep both parties' numbers private"
            >
              contact hidden
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
