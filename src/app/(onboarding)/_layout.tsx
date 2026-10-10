import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="companion" />
      <Stack.Screen name="budget" />
      <Stack.Screen name="interests" />
    </Stack>
  );
}
