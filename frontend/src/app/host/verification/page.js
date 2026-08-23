'use client';
/**
 * HOST VERIFICATION — OWNER: S. Moontaha Rahman [SMR]
 */
import ProtectedRoute from '@/components/ProtectedRoute';
import { ROLES } from '@/lib/constants';
import VerificationWizard from '@/features/host-verification/components/VerificationWizard';

function VerificationScreen() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-h1">Get verified</h1>
        <p className="mt-1 text-body text-ink-muted">
          We check every host before their space goes live. Drivers are trusting you with their car.
        </p>
      </div>
      <VerificationWizard />
    </main>
  );
}

export default function HostVerificationPage() {
  return (
    <ProtectedRoute roles={[ROLES.HOST, ROLES.ADMIN]}>
      <VerificationScreen />
    </ProtectedRoute>
  );
}
