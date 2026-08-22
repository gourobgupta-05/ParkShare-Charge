'use client';
/**
 * useChatSocket — OWNER: Maidul Islam [MI]
 *
 * Live messaging over the /chat namespace with a REST fallback. If the socket
 * is unavailable — a blocked network, or Render cold-starting — sending still
 * works over HTTP rather than failing silently, which is the difference
 * between a demo that survives the room's wifi and one that doesn't.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { SOCKET_NAMESPACES, SOCKET_EVENTS } from '@/lib/constants';
import { getMessages, sendMessage as sendViaRest, markRead as markReadRest } from '../api/chat.api';

export default function useChatSocket(threadId) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(threadId));
  const [typingUser, setTypingUser] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const typingTimer = useRef(null);

  /* ------------------------------------------------------------- history -- */
  useEffect(() => {
    if (!threadId) {
      setMessages([]);
      setIsLoading(false);
      return undefined;
    }
    let cancelled = false;

    setIsLoading(true);
    getMessages(threadId)
      .then((data) => !cancelled && setMessages(data.items || []))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setIsLoading(false));

    return () => { cancelled = true; };
  }, [threadId]);

  /* -------------------------------------------------------------- socket -- */
  useEffect(() => {
    if (!threadId) return undefined;

    const socket = getSocket(SOCKET_NAMESPACES.CHAT);
    if (!socket) return undefined;
    socketRef.current = socket;

    const join = () => {
      setIsConnected(true);
      socket.emit(SOCKET_EVENTS.CHAT_JOIN, { threadId }, (ack) => {
        if (!ack?.ok) setError(ack?.message || 'Could not open this conversation');
      });
      socket.emit(SOCKET_EVENTS.CHAT_READ, { threadId }, () => {});
    };

    const onMessage = (message) => {
      if (String(message.threadId) !== String(threadId)) return;
      setMessages((prev) => {
        // The sender's optimistic copy is replaced by the server's version.
        if (prev.some((m) => String(m._id) === String(message._id))) return prev;
        return [...prev.filter((m) => !m.isPending || m.body !== message.body), message];
      });
    };

    const onTyping = ({ threadId: id, userId, isTyping }) => {
      if (String(id) !== String(threadId)) return;
      setTypingUser(isTyping ? userId : null);
      if (isTyping) {
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTypingUser(null), 4000);
      }
    };

    const onRead = ({ threadId: id }) => {
      if (String(id) !== String(threadId)) return;
      setMessages((prev) => prev.map((m) => (m.isMine && !m.readAt ? { ...m, readAt: new Date() } : m)));
    };

    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, onMessage);
    socket.on(SOCKET_EVENTS.CHAT_TYPING, onTyping);
    socket.on(SOCKET_EVENTS.CHAT_READ, onRead);

    if (socket.connected) join();

    return () => {
      socket.emit('chat:leave', { threadId });
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENTS.CHAT_MESSAGE, onMessage);
      socket.off(SOCKET_EVENTS.CHAT_TYPING, onTyping);
      socket.off(SOCKET_EVENTS.CHAT_READ, onRead);
      clearTimeout(typingTimer.current);
    };
  }, [threadId]);

  /* ---------------------------------------------------------------- send -- */
  const send = useCallback(
    async (body) => {
      const text = String(body || '').trim();
      if (!text || !threadId) return null;
      setError(null);

      // Optimistic bubble so the input feels instant.
      const optimistic = {
        _id: `pending-${Date.now()}`,
        threadId,
        body: text,
        isMine: true,
        isPending: true,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      const socket = socketRef.current;
      if (socket?.connected) {
        return new Promise((resolve) => {
          socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, { threadId, body: text }, (ack) => {
            if (ack?.ok) {
              resolve(ack.message);
            } else {
              setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
              setError(ack?.message || 'Message could not be sent');
              resolve(null);
            }
          });
        });
      }

      // Socket unavailable — fall back to HTTP.
      try {
        const message = await sendViaRest(threadId, text);
        setMessages((prev) => prev.map((m) => (m._id === optimistic._id ? { ...message, isMine: true } : m)));
        return message;
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
        setError(err.message);
        return null;
      }
    },
    [threadId]
  );

  const setTyping = useCallback(
    (isTyping) => {
      const socket = socketRef.current;
      if (socket?.connected && threadId) {
        socket.emit(SOCKET_EVENTS.CHAT_TYPING, { threadId, isTyping });
      }
    },
    [threadId]
  );

  const markRead = useCallback(async () => {
    if (!threadId) return;
    const socket = socketRef.current;
    if (socket?.connected) socket.emit(SOCKET_EVENTS.CHAT_READ, { threadId }, () => {});
    else await markReadRest(threadId).catch(() => {});
  }, [threadId]);

  return { messages, isConnected, isLoading, typingUser, error, send, setTyping, markRead };
}
