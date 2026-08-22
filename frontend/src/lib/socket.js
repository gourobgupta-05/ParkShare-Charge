'use client';
/**
 * ============================================================================
 * 🔒 SOCKET CLIENT — shared infrastructure
 * ============================================================================
 * ⚠️ NEW SHARED FILE, authored by Maidul Islam [MI].
 * The Phase 1 plan lists `lib/socket.js` as a frozen initializer file, but it
 * was never created during the scaffold. Both realtime features (IoT telemetry
 * and chat) need exactly one connection factory, and duplicating it inside two
 * feature folders would guarantee they drift apart. It is written here to the
 * plan's spec and should be treated as frozen from now on.
 *
 * One connection per namespace, shared across every component that asks for
 * it. The auth token is read at connect time from the same store the API
 * client uses, so a socket can never outlive a signed-out session.
 * ============================================================================
 */
import { io } from 'socket.io-client';
import { tokenStore } from './api';

const SOCKET_URL = (
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:5000'
).replace(/\/$/, '');

const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io';

/** namespace -> live socket */
const sockets = new Map();

/**
 * Returns the shared socket for a namespace, connecting on first use.
 * @param {string} namespace e.g. '/iot' or '/chat'
 */
export function getSocket(namespace) {
  if (typeof window === 'undefined') return null; // never connect during SSR

  const existing = sockets.get(namespace);
  if (existing) return existing;

  const socket = io(`${SOCKET_URL}${namespace}`, {
    path: SOCKET_PATH,
    auth: { token: tokenStore.access },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    // Render's free tier cold-starts for 30-60s after sleeping, so the backoff
    // ceiling is deliberately generous rather than giving up early.
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
    autoConnect: true,
  });

  // Refresh the token on every reconnect — the old one may have expired while
  // the socket was down.
  socket.on('reconnect_attempt', () => {
    socket.auth = { token: tokenStore.access };
  });

  sockets.set(namespace, socket);
  return socket;
}

/** Closes one namespace's socket. */
export function closeSocket(namespace) {
  const socket = sockets.get(namespace);
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  sockets.delete(namespace);
}

/** Closes everything — call on sign-out. */
export function closeAllSockets() {
  for (const namespace of [...sockets.keys()]) closeSocket(namespace);
}

export default getSocket;
