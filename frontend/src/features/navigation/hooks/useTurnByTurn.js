'use client';
/**
 * useTurnByTurn — OWNER: Maidul Islam [MI]
 *
 * Watches the driver's position, keeps the ETA fresh, and tracks which step of
 * the route they are on. Uses watchPosition rather than polling
 * getCurrentPosition, because the browser batches GPS updates far more
 * efficiently and the battery cost is noticeably lower.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { startRoute, refreshEta } from '../api/navigation.api';

const REFRESH_MS = Number(process.env.NEXT_PUBLIC_NAV_REFRESH_MS) || 15000;

export default function useTurnByTurn(bookingId) {
  const [route, setRoute] = useState(null);
  const [position, setPosition] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasArrived, setHasArrived] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const watchId = useRef(null);
  const lastRefresh = useRef(0);
  const positionRef = useRef(null);

  /* --------------------------------------------------- position watcher -- */
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('This device cannot share its location, so navigation is unavailable.');
      return undefined;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        };
        positionRef.current = next;
        setPosition(next);
        setPermissionDenied(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true);
          setError('Location permission is off. Turn it on to navigate to the entrance.');
        } else {
          setError('Could not read your location. Move somewhere with a clearer signal.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  /* --------------------------------------------------------- start route -- */
  const start = useCallback(async () => {
    const origin = positionRef.current;
    if (!origin) {
      setError('Waiting for your location — this usually takes a few seconds.');
      return null;
    }

    setIsStarting(true);
    setError(null);
    try {
      const data = await startRoute(bookingId, { lat: origin.lat, lng: origin.lng });
      setRoute(data);
      setStepIndex(0);
      setHasArrived(false);
      lastRefresh.current = Date.now();
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsStarting(false);
    }
  }, [bookingId]);

  /* ------------------------------------------------------------ ETA loop -- */
  useEffect(() => {
    if (!route || hasArrived) return undefined;

    const timer = setInterval(async () => {
      const origin = positionRef.current;
      if (!origin) return;
      if (Date.now() - lastRefresh.current < REFRESH_MS - 500) return;

      try {
        const data = await refreshEta(bookingId, origin);
        lastRefresh.current = Date.now();

        if (data.hasArrived) {
          setHasArrived(true);
          setRoute((r) => ({ ...r, etaSeconds: 0, straightLineMeters: data.straightLineMeters }));
          return;
        }
        setRoute((r) => ({ ...r, ...data }));
      } catch {
        // A failed refresh is not fatal — the last known route stays on screen.
      }
    }, REFRESH_MS);

    return () => clearInterval(timer);
  }, [route, hasArrived, bookingId]);

  /* ------------------------------------------------- step progress guess -- */
  useEffect(() => {
    if (!route?.steps?.length || !position || hasArrived) return;

    // Distance remaining shrinks as the driver progresses; map that onto the
    // step list so the current instruction advances without a routing call.
    const total = route.distanceMeters || 0;
    const remaining = route.straightLineMeters ?? total;
    const covered = Math.max(total - remaining, 0);

    let accumulated = 0;
    let index = 0;
    for (let i = 0; i < route.steps.length; i += 1) {
      accumulated += route.steps[i].distanceMeters || 0;
      if (covered < accumulated) {
        index = i;
        break;
      }
      index = i;
    }
    setStepIndex(index);
  }, [route, position, hasArrived]);

  return {
    route, position, stepIndex, hasArrived,
    isStarting, error, permissionDenied,
    start,
    currentStep: route?.steps?.[stepIndex] || null,
    nextStep: route?.steps?.[stepIndex + 1] || null,
  };
}
