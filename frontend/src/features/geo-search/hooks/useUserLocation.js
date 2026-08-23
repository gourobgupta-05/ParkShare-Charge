'use client';
/**
 * useUserLocation — OWNER: Tamal Deb Nath [TDN]
 * Wraps the browser geolocation API with a Dhaka fallback, so the map always
 * renders something even when permission is denied or the device has no GPS.
 */
import { useCallback, useEffect, useState } from 'react';
import { PLATFORM } from '@/lib/constants';

const FALLBACK = {
  lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT) || PLATFORM.DHAKA_CENTER.lat,
  lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG) || PLATFORM.DHAKA_CENTER.lng,
};

export default function useUserLocation({ auto = true } = {}) {
  const [coords, setCoords] = useState(FALLBACK);
  const [isPrecise, setIsPrecise] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState(null);

  const locate = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('This device cannot share its location. Showing central Dhaka.');
      return;
    }
    setIsLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsPrecise(true);
        setIsLocating(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission is off. Showing central Dhaka — turn it on for nearby results.'
            : 'Could not read your location. Showing central Dhaka.'
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    if (auto) locate();
  }, [auto, locate]);

  /** Manual override — used when the driver drags the map pin. */
  const setManual = useCallback((next) => {
    setCoords(next);
    setIsPrecise(false);
  }, []);

  return { coords, isPrecise, isLocating, error, locate, setManual, fallback: FALLBACK };
}
