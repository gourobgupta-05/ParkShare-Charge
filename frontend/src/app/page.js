/** 🔒 Landing page. Replace the copy later; keep the token usage. */
import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6">
      <div>
        <p className="text-overline uppercase text-ink-brand">Dhaka · parking &amp; EV charging</p>
        <h1 className="mt-2 text-display-lg">
          Park in someone&apos;s garage.<br />Charge while you&apos;re there.
        </h1>
        <p className="mt-4 max-w-xl text-body text-ink-muted">
          Book a residential slot or a mall bay by the hour, pay into escrow, and watch your
          charge draw live. Hosts earn on space they weren&apos;t using.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/register/driver"><Button size="lg">Find parking</Button></Link>
        <Link href="/register/host"><Button size="lg" variant="outline">List your space</Button></Link>
        <Link href="/login"><Button size="lg" variant="ghost">Sign in</Button></Link>
      </div>

      <p className="text-caption text-ink-subtle">
        CSE471 System Analysis and Design — shared foundation. Feature screens are built by each
        team member inside <code className="numeric">src/features/</code>.
      </p>
    </main>
  );
}
