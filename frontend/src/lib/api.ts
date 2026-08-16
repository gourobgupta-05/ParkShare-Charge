/**
 * API client — Navigation feature only (Module 1, Maidul Islam).
 * Set NEXT_PUBLIC_API_BASE_URL in .env.local, e.g.:
 *   NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
 */
// Module 1 — Navigation API client // Author: Maidul Islam (23301467)
const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

async function handle(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export interface RouteResult {
  mode: string;
  distanceKm: number;
  durationMin: number;
  etaTimestamp: string;
  geometry: { type: string; coordinates: [number, number][] };
  steps: { instruction: string; distanceKm: number }[];
}

export async function getRoute(params: {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}): Promise<RouteResult> {
  const qs = new URLSearchParams({
    originLat: String(params.originLat),
    originLng: String(params.originLng),
    destLat: String(params.destLat),
    destLng: String(params.destLng),
  });
  const res = await fetch(`${BASE_URL}/navigation/route?${qs.toString()}`);
  return handle(res);
}
