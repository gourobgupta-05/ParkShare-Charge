'use client';
/**
 * COMPOSER — OWNER: Maidul Islam [MI]
 * Warns before sending when the text contains something that looks like a
 * phone number, so the redaction is never a surprise.
 */
import { useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/formatters';

const MAX = Number(process.env.NEXT_PUBLIC_CHAT_MAX_LENGTH) || 1000;
// Mirrors the server-side pattern; the server remains the authority.
const CONTACT_RE = /(?:\+?88[\s-]?)?01[3-9][\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d|[\w.+-]+@[\w-]+\.[\w.]{2,}/;

export default function Composer({ onSend, onTyping, disabled }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const typingRef = useRef(false);
  const stopTimer = useRef(null);

  const willRedact = CONTACT_RE.test(value);

  function handleChange(e) {
    setValue(e.target.value);

    if (!typingRef.current) {
      typingRef.current = true;
      onTyping?.(true);
    }
    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      typingRef.current = false;
      onTyping?.(false);
    }, 1500);
  }

  async function submit() {
    const text = value.trim();
    if (!text || busy) return;

    setBusy(true);
    setValue('');
    typingRef.current = false;
    onTyping?.(false);

    try {
      await onSend(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-line bg-surface p-3">
      {willRedact && (
        <p className="mb-2 rounded bg-warning-subtle px-2 py-1 text-caption text-warning-fg">
          Contact details will be hidden. Arrange everything through the app.
        </p>
      )}

      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          value={value}
          maxLength={MAX}
          disabled={disabled}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={disabled ? 'This conversation is closed' : 'Message the host…'}
          className={cn(
            'max-h-32 min-h-[40px] flex-1 resize-none rounded border border-line bg-surface px-3 py-2',
            'text-body text-ink placeholder:text-ink-subtle disabled:opacity-50'
          )}
        />
        <Button onClick={submit} isLoading={busy} disabled={disabled || !value.trim()} size="md">
          Send
        </Button>
      </div>

      <div className="mt-1 flex justify-end">
        <span className="numeric text-caption text-ink-subtle">
          {value.length}/{MAX}
        </span>
      </div>
    </div>
  );
}
