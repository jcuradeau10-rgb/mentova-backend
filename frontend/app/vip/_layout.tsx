import { Stack } from 'expo-router';

export default function VIPLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0A0A1A' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="hub" />
      <Stack.Screen name="success" />
    </Stack>
  );
}
