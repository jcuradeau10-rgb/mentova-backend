import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../store/authStore';

const API = process.env.EXPO_PUBLIC_BACKEND_URL || '';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const { token, isAuthenticated } = useAuthStore();
  const registered = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !token || registered.current) return;
    if (Platform.OS === 'web') return; // Push not supported on web

    registerPushToken();
    registered.current = true;
  }, [isAuthenticated, token]);

  const registerPushToken = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      const pushToken = (await Notifications.getExpoPushTokenAsync()).data;
      if (!pushToken) return;

      await fetch(`${API}/api/notifications/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token: pushToken }),
      });
    } catch (e) {
      console.warn('Push registration failed:', e);
    }
  };
}
