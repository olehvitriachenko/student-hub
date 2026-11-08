import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { usePalette } from '../theme/theme';

/** Кореневий layout. Поки що одна сторінка — MainPage (src/app/index.tsx). */
export default function RootLayout() {
  const c = usePalette();
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Особистий кабінет' }} />
      </Stack>
    </>
  );
}
