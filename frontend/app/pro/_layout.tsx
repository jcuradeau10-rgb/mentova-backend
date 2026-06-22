import React from 'react';
import { Stack } from 'expo-router';

export default function ProLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0A12' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="join" />
      <Stack.Screen name="apply" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
