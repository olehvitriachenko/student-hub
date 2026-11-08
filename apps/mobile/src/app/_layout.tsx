import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';
import { Services, bootstrap, container } from '../AppServices';
import { usePalette } from '../theme/theme';

/**
 * Кореневий layout — аналог AppShell (лаб. 2).
 *
 * Маршрути Expo Router реєструються файлами в src/app (аналог Routing.RegisterRoute):
 *   /                → index.tsx           (список студентів, MainPage)
 *   /students/[id]   → students/[id].tsx   (StudentDetailPage, також deep link)
 *   /settings        → settings.tsx
 *   /logs            → logs.tsx
 */
function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const c = usePalette();

  useEffect(() => {
    bootstrap()
      .then(() => setReady(true))
      .catch((e: Error) => setError(e));
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.background }}>
        <Text style={{ color: c.danger, fontWeight: '600', marginBottom: 8 }}>Не вдалося запустити застосунок</Text>
        <Text style={{ color: c.textMuted }}>{error.message}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <>
      <RouteTracker />
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Особистий кабінет' }} />
        <Stack.Screen name="students/[id]" options={{ title: 'Деталі студента' }} />
        <Stack.Screen name="settings" options={{ title: 'Налаштування' }} />
        <Stack.Screen name="logs" options={{ title: 'Журнал подій' }} />
      </Stack>
    </>
  );
}

/** Відстежує поточний екран: стан сесії (лаб. 3) + аналітика екранів (лаб. 5). */
function RouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    container.get(Services.AppState).setCurrentRoute(pathname);
    container.get(Services.Analytics).trackScreen(pathname);
  }, [pathname]);
  return null;
}

export default Sentry.wrap(RootLayout);
