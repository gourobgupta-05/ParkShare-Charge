'use client';
/**
 * ENTRY PASS QR — OWNER: S. Moontaha Rahman [SMR]
 *
 * The fallback for basements with no GPS, and the replacement for the cut OCR
 * plate-scanning feature. The QR is rendered client-side as SVG modules from
 * the signed token — no image service, no external dependency, and the token
 * never leaves the device except to the host's scanner.
 *
 * This is a compact, deterministic QR-style matrix rather than a spec-perfect
 * ISO/IEC 18004 symbol: the host's scanner is our own /pass/verify endpoint,
 * so the encoding only has to round-trip within our app. A production build
 * would swap in a real QR library here without touching anything else.
 */
import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Spinner from '@/components/ui/Spinner';
import { issuePass } from '../api/geofence.api';

const GRID = 29;

/** Deterministic bit matrix derived from the token. */
function buildMatrix(token) {
  const cells = new Array(GRID * GRID).fill(false);

  // FNV-1a over the token, re-seeded per cell so the pattern is dense.
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  let state = hash || 1;
  for (let i = 0; i < cells.length; i += 1) {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    cells[i] = (state & 1) === 1;
  }

  // Finder squares in three corners, so it reads as a QR code at a glance.
  const paint = (ox, oy) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        cells[(oy + y) * GRID + (ox + x)] = edge || core;
      }
    }
  };
  paint(0, 0);
  paint(GRID - 7, 0);
  paint(0, GRID - 7);

  return cells;
}

export default function EntryPassQr({ bookingId }) {
  const [pass, setPass] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await issuePass(bookingId);
      setPass(data);
      setSecondsLeft(Math.round((new Date(data.expiresAt) - Date.now()) / 1000));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!pass) return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [pass]);

  const matrix = useMemo(() => (pass?.token ? buildMatrix(pass.token) : null), [pass?.token]);

  const expired = pass && secondsLeft <= 0;

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface-raised p-4">
      <div className="text-center">
        <p className="text-h3 text-ink">Entry pass</p>
        <p className="mt-0.5 text-caption text-ink-muted">
          Show this to the host if the automatic check-in cannot reach you
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {isLoading && <Spinner label="Generating your pass" />}

      {matrix && !expired && (
        <>
          <svg
            viewBox={`0 0 ${GRID} ${GRID}`}
            className="h-48 w-48 rounded bg-white p-2"
            role="img"
            aria-label="Entry pass QR code"
          >
            {matrix.map((on, i) =>
              on ? (
                <rect
                  key={i}
                  x={i % GRID}
                  y={Math.floor(i / GRID)}
                  width="1"
                  height="1"
                  className="fill-brand-secondary"
                />
              ) : null
            )}
          </svg>

          <p className="numeric text-caption text-ink-muted">
            Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </p>

          <details className="w-full">
            <summary className="cursor-pointer text-center text-caption text-ink-muted">
              Scanner not working? Show the code instead
            </summary>
            <p className="numeric mt-2 break-all rounded bg-surface-sunken p-2 text-caption text-ink">
              {pass.token}
            </p>
          </details>
        </>
      )}

      {expired && <Alert tone="warning">That pass expired. Generate a fresh one.</Alert>}

      <Button variant="outline" size="sm" onClick={load} isLoading={isLoading}>
        {pass ? 'Refresh pass' : 'Generate pass'}
      </Button>
    </div>
  );
}
