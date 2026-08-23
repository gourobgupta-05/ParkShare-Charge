'use client';
/**
 * useMockLocation — OWNER: S. Moontaha Rahman [SMR]
 *
 * A development-only location override. Testing a 15-metre geofence otherwise
 * means physically walking to a seeded coordinate in Dhaka, which is not a
 * viable way to demo the feature in a classroom.
 *
 * Gated on NEXT_PUBLIC_ENABLE_MOCK_LOCATION so it cannot be switched on in a
 * deployed build by accident. The server also records method: 'GEOFENCE'
 * either way, so a mocked check-in is not disguised as something it isn't —
 * the honest position is that this is a test tool, clearly labelled.
 */
import { useCallback, useState } from 'react';

const ENABLED = process.env.NEXT_PUBLIC_ENABLE_MOCK_LOCATION === 'true';

export default function useMockLocation() {
  const [override, setOverride] = useState(null);

  /** Places the simulated driver a given distance from the target. */
  const simulateDistance = useCallback((target, metres) => {
    if (!ENABLED || !target) return null;
    const next = {
      lat: target.lat + metres / 111320,
      lng: target.lng,
      accuracy: 8,
      isMock: true,
    };
    setOverride(next);
    return next;
  }, []);

  const clear = useCallback(() => setOverride(null), []);

  return { enabled: ENABLED, override, simulateDistance, clear };
}
