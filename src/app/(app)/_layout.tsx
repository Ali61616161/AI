import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="assistant" options={{ presentation: 'modal' }} />
      <Stack.Screen name="ticket" options={{ presentation: 'modal' }} />
      <Stack.Screen name="ticket-review" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip/[id]" />
      <Stack.Screen name="trip-dates" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip-versions" options={{ presentation: 'modal' }} />
      <Stack.Screen name="preferences" options={{ presentation: 'modal' }} />
      <Stack.Screen name="hotels" options={{ presentation: 'modal' }} />
      <Stack.Screen name="phrases" options={{ presentation: 'modal' }} />
      <Stack.Screen name="translate" options={{ presentation: 'modal' }} />
      <Stack.Screen name="sos" options={{ presentation: 'modal' }} />
      <Stack.Screen name="expenses" options={{ presentation: 'modal' }} />
      <Stack.Screen name="packing" options={{ presentation: 'modal' }} />
      <Stack.Screen name="visa" options={{ presentation: 'modal' }} />
      <Stack.Screen name="jetlag" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip-documents" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
