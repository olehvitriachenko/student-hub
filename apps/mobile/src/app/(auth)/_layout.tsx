import { Stack } from 'expo-router';
import { usePalette } from '../../theme/theme';

/** Гостьова зона: головний екран → вхід / реєстрація. */
export const unstable_settings = { anchor: 'welcome' };

export default function AuthLayout() {
  const c = usePalette();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
