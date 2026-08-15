import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold">ParkShare & Charge</h1>
        <p className="text-sm text-slate-500">CSE471 Group 9</p>
        <div className="flex flex-col gap-3 mt-6">
          <Link href="/navigation" className="px-4 py-2 rounded-md bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400">
            View Navigation Demo (Maidul)
          </Link>
        </div>
      </div>
    </div>
  );
}