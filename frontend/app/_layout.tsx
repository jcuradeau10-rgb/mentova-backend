import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useLanguageStore } from '../store/languageStore';

export default function RootLayout() {
  const { checkAuth } = useAuthStore();
  const { loadLanguage, isLoaded } = useLanguageStore();
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    const initApp = async () => {
      await Promise.all([
        checkAuth(),
        loadLanguage()
      ]);
      setAppReady(true);
    };
    initApp();
  }, []);

  // Wait for language to be loaded before rendering
  if (!appReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#06060F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#06060F' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="vip" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="admin" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="pro" options={{ headerShown: false }} />
        <Stack.Screen name="bookings" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="support" />
        <Stack.Screen name="landing" />
        <Stack.Screen name="user-profile" />
      </Stack>
    </>
  );
}
