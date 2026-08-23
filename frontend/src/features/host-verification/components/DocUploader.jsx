'use client';
/**
 * DOCUMENT UPLOADER — OWNER: S. Moontaha Rahman [SMR]
 * One tile per required document. Validates size client-side before the
 * upload so a 20 MB photo fails instantly rather than after a slow POST.
 */
import { useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';
import { cn } from '@/lib/formatters';
import { uploadDocument, fileToPayload } from '../api/hostVerification.api';

const MAX_MB = 5;

export default function DocUploader({ kind, label, hint, existing, disabled, onUploaded }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Keep files under ${MAX_MB} MB — that one is ${(file.size / 1024 / 1024).toFixed(1)} MB`);
      return;
    }

    setBusy(true);
    try {
      const payload = await fileToPayload(file);
      const data = await uploadDocument(kind, payload);
      onUploaded?.(data);
    } catch (err) {
      setError(err.details?.file || err.message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const uploaded = Boolean(existing);

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors duration-fast',
        uploaded ? 'border-brand-primary bg-brand-primary-subtle' : 'border-dashed border-line bg-surface'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body font-medium text-ink">{label}</p>
          {hint && <p className="text-caption text-ink-muted">{hint}</p>}
        </div>
        {uploaded && <span className="shrink-0 text-caption font-medium text-ink-brand">Uploaded</span>}
      </div>

      {error && <Alert tone="danger" className="mt-2">{error}</Alert>}

      {busy ? (
        <div className="mt-3"><Spinner size="sm" label="Uploading" /></div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            disabled={disabled}
            onChange={handleFile}
            className="mt-3 block w-full text-caption text-ink-muted file:mr-3 file:rounded file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-caption file:text-ink hover:file:bg-line disabled:opacity-50"
          />
          {uploaded && existing.url && (
            <a
              href={existing.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-caption text-ink-brand underline"
            >
              View current file
            </a>
          )}
        </>
      )}
    </div>
  );
}
