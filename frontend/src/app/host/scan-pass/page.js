'use client';
/**
 * HOST PASS SCANNER — OWNER: S. Moontaha Rahman [SMR]
 */
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/lib/constants';
import PassScanner from '@/features/geofence/components/PassScanner';

function ScanScreen() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Check in a driver</h1>
        <p className="mt-1 text-body text-ink-muted">
          For basements and gated compounds where automatic check-in cannot reach.
        </p>
      </div>
      <PassScanner />
    </main>
  );
}

export default function ScanPassPage() {
  return (
    <ProtectedRoute roles={[ROLES.HOST, ROLES.ADMIN]}>
      <ScanScreen />
    </ProtectedRoute>
  );
}
