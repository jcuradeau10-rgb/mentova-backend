import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const SOCKET_URL = API_URL.replace(/\/api$/, '').replace(/\/$/, '');

type NotificationHandler = (notification: {
  id?: string;
  type: string;
  title?: string;
  body?: string;
  data?: any;
  timestamp: string;
}) => void;

const listeners = new Set<NotificationHandler>();
let globalSocket: Socket | null = null;

export function useWebSocket() {
  const { token, isAuthenticated } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
      }
      return;
    }

    if (globalSocket?.connected) {
      socketRef.current = globalSocket;
      return;
    }

    const socket = io(SOCKET_URL, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    socket.on('connect', () => {
      console.log('[WS] Connected, authenticating...');
      socket.emit('authenticate', { token });
    });

    socket.on('authenticated', (data: any) => {
      if (data.success) {
        console.log('[WS] Authenticated successfully');
      } else {
        console.log('[WS] Auth failed:', data.error);
      }
    });

    socket.on('notification', (data: any) => {
      console.log('[WS] Notification received:', data.type);
      listeners.forEach(handler => handler(data));
    });

    socket.on('broadcast', (data: any) => {
      console.log('[WS] Broadcast received:', data.type);
      listeners.forEach(handler => handler(data));
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
    });

    globalSocket = socket;
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      globalSocket = null;
    };
  }, [isAuthenticated, token]);

  const onNotification = useCallback((handler: NotificationHandler) => {
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  return { onNotification, isConnected: !!globalSocket?.connected };
}
