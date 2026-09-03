'use client';
/**
 * 🔒 SHARED NAVBAR — renders the links from config/nav/index.js.
 *
 * Add links in YOUR OWN config/nav/<name>.nav.js — never in this file.
 * That is the whole point of the registry: link data is per-member, the
 * renderer is shared, so adding a link can never cause a merge conflict.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { navForRole } from '@/config/nav';
import { cn } from '@/lib/formatters';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Signed out — the login and register pages have no nav.
  if (!user) return null;

  const links = navForRole(user.role);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface-raised">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-4 py-2">
        <Link href="/" className="mr-3 font-display text-h3 text-ink-brand">
          ParkShare
        </Link>

        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-full px-3 py-1.5 text-caption font-medium transition-colors duration-fast',
              pathname === item.href || pathname.startsWith(`${item.href}/`)
                ? 'bg-brand-primary-subtle text-ink-brand'
                : 'text-ink-muted hover:text-ink'
            )}
          >
            {item.label}
          </Link>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <Link href="/profile" className="text-caption text-ink-muted hover:text-ink">
            {user.name}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-line px-3 py-1.5 text-caption text-ink-muted hover:border-line-strong"
          >
            Sign out
          </button>
        </div>
      </nav>
    </header>
  );
}