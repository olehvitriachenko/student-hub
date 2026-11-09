import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import { Services, bootstrap, container } from '../AppServices';
import { useViewModel } from '../core/mvvm/hooks';
import type { AuthService } from '../services/AuthService';
import { crashReportingEnabled } from '../services/CrashReporting';
import { usePalette } from '../theme/theme';

/**
 * Кореневий layout — аналог AppShell (лаб. 2).
 *
 * Маршрути Expo Router реєструються файлами в src/app (аналог Routing.RegisterRoute):
 *   (auth)/login, (auth)/register   — вхід і реєстрація (лише для гостей)
 *   (tabs)/index | assignments | profile — нижні вкладки: Розклад, Завдання, Профіль
 *   /assignment/[id], /event/[id]    — завдання та події планувальника, також deep link
 *   /settings, /logs                 — синхронізація та діагностика (лаб. 4–5)
 *
 * Stack.Protected сам перемикає групи маршрутів, коли змінюється AuthService.isAuthenticated.
 */
function RootLayout() {
  const [readyContainer, setReadyContainer] = useState<typeof container | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const c = usePalette();

  useEffect(() => {
    let active = true;
    bootstrap()
      .then(() => { if (active) setReadyContainer(container); })
      .catch((e: Error) => { if (active) setError(e); });
    return () => { active = false; };
    // Fast Refresh can replace the container while preserving component state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: c.background }}>
        <Text style={{ color: c.danger, fontWeight: '600', marginBottom: 8 }}>Не вдалося запустити застосунок</Text>
        <Text style={{ color: c.textMuted }}>{error.message}</Text>
      </View>
    );
  }

  if (readyContainer !== container) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppNavigator auth={container.get(Services.Auth)} />
    </GestureHandlerRootView>
  );
}

function AppNavigator({ auth: authService }: { auth: AuthService }) {
  const auth = useViewModel(authService);
  const c = usePalette();

  return (
    <>
      <RouteTracker />
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.background },
          headerShadowVisible: false,
          headerTintColor: c.text,
          headerTitleStyle: { color: c.text, fontWeight: '700' },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Protected guard={!auth.isAuthenticated}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={auth.isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="assignment/[id]" options={{ title: 'Завдання' }} />
          <Stack.Screen name="event/[id]" options={{ title: 'Подія' }} />
          <Stack.Screen name="focus/[id]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="preferences" options={{ title: 'Налаштування' }} />
          <Stack.Screen name="settings" options={{ title: 'Синхронізація та діагностика' }} />
          <Stack.Screen name="logs" options={{ title: 'Журнал подій' }} />
        </Stack.Protected>
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

// Sentry.wrap має сенс лише коли Sentry ініціалізовано (задано EXPO_PUBLIC_SENTRY_DSN).
export default crashReportingEnabled ? Sentry.wrap(RootLayout) : RootLayout;
