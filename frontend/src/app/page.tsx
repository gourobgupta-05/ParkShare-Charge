import NavigationPanel from "@/components/NavigationPanel";

export default function Home() {
  const DEMO_ORIGIN = { lat: 23.7461, lng: 90.3742 };
  const DEMO_DESTINATION = { lat: 23.7925, lng: 90.4078 };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-semibold">ParkShare & Charge</h1>
        <p className="text-xs text-slate-500">
          Module 1 — Navigation Engine (Maidul Islam)
        </p>
      </header>
      <main className="max-w-xl mx-auto px-6 py-10">
        <NavigationPanel
          origin={DEMO_ORIGIN}
          destination={DEMO_DESTINATION}
          destinationLabel="Jamuna Future Park — B2 charging slot"
        />
      </main>
    </div>
  );
}