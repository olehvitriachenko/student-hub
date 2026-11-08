import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { usePalette } from '../theme/theme';

/**
 * Кореневий layout — аналог AppShell.
 *
 * Маршрути реєструються файлами в src/app (аналог Routing.RegisterRoute):
 *   /               → index.tsx          (MainPage — маршрут за замовчуванням)
 *   /students/[id]  → students/[id].tsx  (StudentDetailPage)
 * Перехід на незареєстрований маршрут відкриє екран "Unmatched Route".
 */
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
        <Stack.Screen name="students/[id]" options={{ title: 'Деталі студента' }} />
      </Stack>
    </>
  );
}
