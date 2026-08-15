import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">ParkShare &amp; Charge</h1>
        <p className="text-sm text-slate-500">Gourob Gupta — Module 1 workspace</p>
      </div>

      <Link
        href="/feedback-demo"
        className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 hover:bg-emerald-100"
      >
        <div>
          <p className="text-sm font-medium text-slate-900">
            Driver-Side Post-Session Feedback &amp; Verification Matrix
          </p>
          <p className="text-xs text-slate-500">F1 — Module 1</p>
        </div>
        <span className="rounded-full bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Live</span>
      </Link>
    </main>
  );
}
