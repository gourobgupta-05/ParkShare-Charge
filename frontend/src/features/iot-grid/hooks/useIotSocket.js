'use client';
/**
 * useIotSocket — OWNER: Maidul Islam [MI]
 *
 * Subscribes to the /iot namespace and keeps a rolling window of readings for
 * the live chart. The window is bounded deliberately: an unbounded array grows
 * by a point every 3 seconds and would eventually stall the browser tab on a
 * long charge.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { SOCKET_NAMESPACES, SOCKET_EVENTS } from '@/lib/constants';
import { getReadings } from '../api/iot.api';

const WINDOW_SECONDS = Number(process.env.NEXT_PUBLIC_IOT_CHART_WINDOW_SECONDS) || 120;
const TICK_ASSUMPTION_MS = 3000;
const MAX_POINTS = Math.max(Math.ceil((WINDOW_SECONDS * 1000) / TICK_ASSUMPTION_MS), 40);

export default function useIotSocket({ sessionId, bookingId, enabled = true }) {
  const [readings, setReadings] = useState([]);
  const [latest, setLatest] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [fault, setFault] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  /* ------------------------------------------------- backfill the chart -- */
  useEffect(() => {
    if (!enabled || !bookingId) return undefined;
    let cancelled = false;

    getReadings(bookingId, MAX_POINTS)
      .then((data) => {
        if (cancelled) return;
        setReadings(data.items || []);
        if (data.items?.length) setLatest(data.items[data.items.length - 1]);
      })
      .catch(() => {
        /* an empty chart is fine — live ticks will fill it */
      });

    return () => { cancelled = true; };
  }, [enabled, bookingId]);

  /* -------------------------------------------------------- live socket -- */
  useEffect(() => {
    if (!enabled || !sessionId) return undefined;

    const socket = getSocket(SOCKET_NAMESPACES.IOT);
    if (!socket) return undefined;
    socketRef.current = socket;

    const onConnect = () => {
      setIsConnected(true);
      setError(null);
      socket.emit(SOCKET_EVENTS.IOT_SUBSCRIBE, { sessionId }, (ack) => {
        if (ack?.ok) setIsRunning(Boolean(ack.running));
        else setError(ack?.message || 'Could not subscribe to this charger');
      });
    };

    const onReading = (reading) => {
      if (String(reading.sessionId) !== String(sessionId)) return;
      setLatest(reading);
      setIsRunning(true);
      setReadings((prev) => {
        const next = [...prev, reading];
        return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
      });
    };

    const onFault = (payload) => setFault(payload);

    const onShutdown = (payload) => {
      if (String(payload.sessionId) !== String(sessionId)) return;
      setIsRunning(false);
    };

    const onDisconnect = () => setIsConnected(false);
    const onConnectError = () =>
      setError('Live telemetry is offline. The server may be waking up — this can take a minute.');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on(SOCKET_EVENTS.IOT_READING, onReading);
    socket.on(SOCKET_EVENTS.IOT_FAULT, onFault);
    socket.on(SOCKET_EVENTS.IOT_SHUTDOWN, onShutdown);

    if (socket.connected) onConnect();

    return () => {
      socket.emit('iot:unsubscribe', { sessionId });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off(SOCKET_EVENTS.IOT_READING, onReading);
      socket.off(SOCKET_EVENTS.IOT_FAULT, onFault);
      socket.off(SOCKET_EVENTS.IOT_SHUTDOWN, onShutdown);
    };
  }, [enabled, sessionId]);

  /** Sends the remote shutdown command over the socket. */
  const requestShutdown = useCallback(
    (reason = 'REMOTE_STOP') =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          reject(new Error('Not connected to the charger'));
          return;
        }
        socket.emit(SOCKET_EVENTS.IOT_SHUTDOWN, { sessionId, reason }, (ack) => {
          if (ack?.ok) {
            setIsRunning(false);
            resolve(ack);
          } else reject(new Error(ack?.message || 'Shutdown failed'));
        });
      }),
    [sessionId]
  );

  return { readings, latest, isConnected, isRunning, fault, error, requestShutdown, maxPoints: MAX_POINTS };
}
