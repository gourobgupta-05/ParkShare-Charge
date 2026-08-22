'use client';
/**
 * 🔒 PROTECTED ROUTE — DO NOT EDIT AFTER INITIAL SETUP
 * Wrap any page that needs a session. Optionally restrict by role.
 *
 *   export default function Page() {
 *     return (
 *       <ProtectedRoute roles={[ROLES.HOST]}>
 *         <MyHostScreen />
 *       </ProtectedRoute>
 *     );
 *   }
 */
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, HOME_BY_ROLE } from '@/context/AuthContext';
import Spinner from '@/components/ui/Spinner';

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (roles.length && !roles.includes(user.role)) {
      router.replace(HOME_BY_ROLE[user.role] || '/');
    }
  }, [isLoading, isAuthenticated, user, roles, router, pathname]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner label="Checking your session" />
      </div>
    );
  }

  if (roles.length && !roles.includes(user.role)) return null;

  return children;
}
