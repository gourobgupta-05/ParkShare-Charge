'use client';
/**
 * useProximityWatcher — OWNER: S. Moontaha Rahman [SMR]
 *
 * Background coordinate monitoring. Watches the device position and posts it
 * to the geofence endpoint; when the driver crosses 15 m the server flips the
 * booking to ACTIVE and this hook reports the check-in.
 *
 * watchPosition rather than a polling loop of getCurrentPosition: the browser
 * batches GPS updates far more efficiently, which matters when this may run
 * for several minutes while someone circles a car park.
 *
 * Pings are throttled independently of GPS updates — a phone can emit position
 * events several times a second, and posting each one would be abusive.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PLATFORM } from '@/lib/constants';
import { ping as pingApi } from '../api/geofence.api';

const PING_INTERVAL_MS = (Number(process.env.NEXT_PUBLIC_GEOFENCE_POLL_SECONDS) || 10) * 1000;

export default function useProximityWatcher({ bookingId, target, active = true, mockCoords = null }) {
  const [position, setPosition] = useState(null);
  const [proximity, setProximity] = useState(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const watchId = useRef(null);
  const positionRef = useRef(null);
  const lastPing = useRef(0);
  const inFlight = useRef(false);

  /* -------------------------------------------------------- GPS watcher -- */
  useEffect(() => {
    if (!active || mockCoords) return undefined;
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('This device cannot share its location. Use your entry pass instead.');
      return undefined;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        positionRef.current = next;
        setPosition(next);
        setPermissionDenied(false);
        setError(null);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true);
          setError('Location permission is off. Turn it on, or check in with your entry pass.');
        } else {
          setError('Could not read your location. In a basement, use your entry pass instead.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [active, mockCoords]);

  /* ---------------------------------------------------- mock override --- */
  useEffect(() => {
    if (!mockCoords) return;
    positionRef.current = mockCoords;
    setPosition(mockCoords);
  }, [mockCoords]);

  /* ------------------------------------------------------- ping the API -- */
  const sendPing = useCallback(async () => {
    const coords = positionRef.current;
    if (!coords || !bookingId || inFlight.current || isCheckedIn) return;

    inFlight.current = true;
    lastPing.current = Date.now();

    try {
      const data = await pingApi(bookingId, coords);
      setProximity(data);

      if (data.checkedIn) {
        setIsCheckedIn(true);
        if (data.justCheckedIn) setJustCheckedIn(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      inFlight.current = false;
    }
  }, [bookingId, isCheckedIn]);

  useEffect(() => {
    if (!active || isCheckedIn) return undefined;

    sendPing(); // fire immediately so the distance shows without waiting
    const timer = setInterval(() => {
      if (Date.now() - lastPing.current >= PING_INTERVAL_MS - 250) sendPing();
    }, PING_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [active, isCheckedIn, sendPing]);

  return {
    position,
    proximity,
    isCheckedIn,
    justCheckedIn,
    error,
    permissionDenied,
    refresh: sendPing,
    pingIntervalMs: PING_INTERVAL_MS,
    radiusM: Number(process.env.NEXT_PUBLIC_GEOFENCE_RADIUS_M) || PLATFORM.GEOFENCE_RADIUS_M,
  };
}
