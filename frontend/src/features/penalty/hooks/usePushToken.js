'use client';
/**
 * usePushToken — OWNER: S. Moontaha Rahman [SMR]
 *
 * Registers the browser for Firebase Cloud Messaging and sends the token to
 * the backend, which stores it on user.fcmTokens.
 *
 * Every step degrades rather than throws:
 *   - no NEXT_PUBLIC_FIREBASE_* config  → returns unsupported, app unaffected
 *   - permission denied                 → in-app notifications still work
 *   - service worker unavailable        → same
 *
 * That matters because penalty alerts are also written to the Notification
 * collection, so the bell icon shows them whether or not push ever succeeds.
 */
import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

const CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const isConfigured = Boolean(CONFIG.apiKey && CONFIG.projectId && VAPID_KEY);

export default function usePushToken({ auto = false } = {}) {
  const [permission, setPermission] = useState('default');
  const [token, setToken] = useState(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const register = useCallback(async () => {
    if (!isConfigured) {
      setError('Push notifications are not configured for this build. In-app alerts still work.');
      return null;
    }
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) {
      setError('This browser does not support push notifications.');
      return null;
    }

    setIsBusy(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        setError('Notifications are blocked. You will still see alerts in the app.');
        return null;
      }

      await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      // Firebase SDK is loaded on demand — it is never part of the main bundle.
      const { initializeApp, getApps } = await import('firebase/app');
      const { getMessaging, getToken } = await import('firebase/messaging');

      const app = getApps().length ? getApps()[0] : initializeApp(CONFIG);
      const messaging = getMessaging(app);

      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: await navigator.serviceWorker.ready,
      });

      if (!fcmToken) {
        setError('Could not obtain a push token.');
        return null;
      }

      // The shared profile endpoint stores it on the user document.
      await api.patch('/profile/preferences', { fcmToken });
      setToken(fcmToken);
      return fcmToken;
    } catch (err) {
      setError(err.message || 'Push registration failed. In-app alerts still work.');
      return null;
    } finally {
      setIsBusy(false);
    }
  }, []);

  useEffect(() => {
    if (auto && isConfigured && permission === 'granted' && !token) register();
  }, [auto, permission, token, register]);

  return { isConfigured, permission, token, isBusy, error, register };
}
