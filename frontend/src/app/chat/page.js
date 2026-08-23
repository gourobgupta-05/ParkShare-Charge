'use client';
/**
 * MESSAGES — OWNER: Maidul Islam [MI]
 * Full-page inbox. Works for drivers and hosts; neither ever sees the other's
 * phone number.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import { cn } from '@/lib/formatters';
import ThreadList from '@/features/chat/components/ThreadList';
import MessageBubble from '@/features/chat/components/MessageBubble';
import Composer from '@/features/chat/components/Composer';
import useChatSocket from '@/features/chat/hooks/useChatSocket';
import { listThreads } from '@/features/chat/api/chat.api';

function ChatScreen() {
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  const { messages, isConnected, isLoading: loadingMessages, typingUser, error: chatError, send, setTyping, markRead } =
    useChatSocket(active?._id || null);

  const load = useCallback(() => {
    setIsLoading(true);
    listThreads()
      .then((data) => {
        setThreads(data.items || []);
        setActive((current) => current || data.items?.[0] || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (messages.length) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      markRead();
    }
  }, [messages.length, markRead]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div>
        <h1 className="text-h1">Messages</h1>
        <p className="mt-1 text-body text-ink-muted">
          Coordinate arrival and access. Phone numbers stay private on both sides.
        </p>
      </div>

      {error && <Alert tone="danger" className="mt-4">{error}</Alert>}

      {isLoading ? (
        <div className="py-16"><Spinner label="Loading conversations" /></div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <section>
            <ThreadList threads={threads} activeId={active?._id} onSelect={setActive} />
          </section>

          <section className="flex min-h-[60vh] flex-col overflow-hidden rounded-lg border border-line">
            {active ? (
              <>
                <header className="flex items-center justify-between border-b border-line bg-surface-raised px-4 py-3">
                  <div>
                    <p className="text-h3 text-ink">{active.counterparty?.name}</p>
                    <p className="text-caption text-ink-muted">
                      {typingUser ? 'typing…' : active.property?.title || 'Booking'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-caption font-medium',
                      isConnected ? 'bg-success-subtle text-success-fg' : 'bg-warning-subtle text-warning-fg'
                    )}
                  >
                    {isConnected ? 'Live' : 'Reconnecting'}
                  </span>
                </header>

                <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-surface-sunken px-3 py-3">
                  {loadingMessages && <div className="py-6"><Spinner label="Loading messages" /></div>}
                  {chatError && <Alert tone="danger">{chatError}</Alert>}
                  {!loadingMessages && !messages.length && (
                    <p className="py-6 text-center text-caption text-ink-muted">
                      No messages yet. Say hello.
                    </p>
                  )}
                  {messages.map((m) => (
                    <MessageBubble key={m._id} message={m} />
                  ))}
                  <div ref={bottomRef} />
                </div>

                <Composer onSend={send} onTyping={setTyping} />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState
                  title="No conversation selected"
                  description="Chats open automatically once a booking is paid for."
                />
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatScreen />
    </ProtectedRoute>
  );
}
