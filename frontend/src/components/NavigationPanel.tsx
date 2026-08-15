"use client";  // Module 1 — Turn-by-Turn Smart In-App Navigation Engine // Author: Maidul Islam (23301467)

import { useState } from "react";
import { getRoute, RouteResult } from "@/lib/api";

interface Props {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  destinationLabel?: string;
}

export default function NavigationPanel({
  origin,
  destination,
  destinationLabel = "Charging slot",
}: Props) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGetDirections() {
    setLoading(true);
    setError(null);
    try {
      const result = await getRoute({
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
      });
      setRoute(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch route");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200 tracking-wide">
          Navigate to {destinationLabel}
        </h3>
        <button
          onClick={handleGetDirections}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Calculating…" : "Get directions"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {route && (
        <div className="space-y-3">
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-slate-500">Distance</span>
              <p className="text-slate-100 font-medium">{route.distanceKm} km</p>
            </div>
            <div>
              <span className="text-slate-500">ETA</span>
              <p className="text-slate-100 font-medium">{route.durationMin} min</p>
            </div>
            <div>
              <span className="text-slate-500">Arrival</span>
              <p className="text-slate-100 font-medium">
                {new Date(route.etaTimestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          <ol className="space-y-1.5 border-t border-slate-800 pt-3">
            {route.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="mt-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 text-[10px] shrink-0">
                  {i + 1}
                </span>
                {step.instruction}
                {step.distanceKm > 0 && (
                  <span className="text-slate-600">· {step.distanceKm} km</span>
                )}
              </li>
            ))}
          </ol>

          {route.mode === "mock" && (
            <p className="text-[10px] text-amber-500/70">
              Simulated route (Mapbox key not configured)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
