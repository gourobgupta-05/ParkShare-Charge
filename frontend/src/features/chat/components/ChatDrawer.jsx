'use client';
/**
 * CHAT DRAWER — OWNER: Maidul Islam [MI]
 * Drops into any booking screen. Opens the thread on demand so a booking page
 * does not create a conversation nobody asked for.
 */
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import { cn } from '@/lib/formatters';
import useChatSocket from '../hooks/useChatSocket';
import { ensureThread } from '../api/chat.api';
import MessageBubble from './MessageBubble';
import Composer from './Composer';

export default function ChatDrawer({ bookingId, counterpartyName = 'the host', triggerLabel = 'Message host' }) {
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(null);
  const bottomRef = useRef(null);

  const { messages, isConnected, isLoading, typingUser, error, send, setTyping, markRead } =
    useChatSocket(open ? threadId : null);

  useEffect(() => {
    if (open && messages.length) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      markRead();
    }
  }, [open, messages.length, markRead]);

  async function openDrawer() {
    setOpening(true);
    setOpenError(null);
    try {
      const thread = await ensureThread(bookingId);
      setThreadId(thread._id);
      setOpen(true);
    } catch (err) {
      setOpenError(err.message);
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button variant="outline" onClick={openDrawer} isLoading={opening} size="sm">
          {triggerLabel}
        </Button>
        {openError && <Alert tone="danger">{openError}</Alert>}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-brand-secondary/60 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Conversation with ${counterpartyName}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-3 sm:h-[70vh] sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <p className="text-h3 text-ink">{counterpartyName}</p>
                <p className="text-caption text-ink-muted">
                  {typingUser ? 'typing…' : isConnected ? 'Connected' : 'Reconnecting…'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close conversation"
                className="text-h2 leading-none text-ink-muted hover:text-ink"
              >
                ×
              </button>
            </header>

            <div className={cn('flex flex-1 flex-col gap-2 overflow-y-auto bg-surface-sunken px-3 py-3')}>
              {isLoading && <div className="py-6"><Spinner label="Loading messages" /></div>}
              {error && <Alert tone="danger">{error}</Alert>}

              {!isLoading && !messages.length && (
                <p className="py-6 text-center text-caption text-ink-muted">
                  No messages yet. Say hello — phone numbers stay private.
                </p>
              )}

              {messages.map((m) => (
                <MessageBubble key={m._id} message={m} />
              ))}
              <div ref={bottomRef} />
            </div>

            <Composer onSend={send} onTyping={setTyping} />
          </div>
        </div>
      )}
    </>
  );
}
