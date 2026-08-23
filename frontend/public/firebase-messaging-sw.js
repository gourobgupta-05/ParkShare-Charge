/**
 * FIREBASE MESSAGING SERVICE WORKER — OWNER: S. Moontaha Rahman [SMR]
 *
 * Receives push notifications while the app is closed or backgrounded.
 *
 * ⚠️ A service worker cannot read process.env — it is served as a static file,
 * not processed by the Next.js build. The config below must therefore be
 * filled in by hand with your project's PUBLIC Firebase values. That is safe:
 * every NEXT_PUBLIC_FIREBASE_* value is already exposed to the browser by
 * design. Never put a private key or the VAPID secret here.
 *
 * Left blank, the worker no-ops and in-app notifications continue to work.
 */
/* eslint-disable no-undef */

const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

if (FIREBASE_CONFIG.projectId) {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification || {};
    const data = payload.data || {};

    self.registration.showNotification(title || 'ParkShare & Charge', {
      body: body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.type || 'parkshare',
      data,
      // A penalty alert must not be dismissed without being seen.
      requireInteraction: data.type === 'PENALTY',
    });
  });
}

/** Tapping the notification opens the relevant screen. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.deepLink || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(link) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(link) : undefined;
    })
  );
});
