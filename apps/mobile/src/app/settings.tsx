import { ScrollView, Text, View } from 'react-native';
import { Services } from '../AppServices';
import { usePageViewModel } from '../core/mvvm/usePageViewModel';
import { Card, CommandButton, Row, SectionTitle } from '../components/ui';
import type { ThemePreference } from '../services/ThemeService';
import { spacing, usePalette } from '../theme/theme';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Системна' },
  { value: 'light', label: 'Світла' },
  { value: 'dark', label: 'Темна' },
];

const time = (t: number | null) => (t ? new Date(t).toLocaleTimeString() : '—');

export default function SettingsPage() {
  const vm = usePageViewModel(Services.SettingsViewModel);
  const c = usePalette();

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <SectionTitle>Тема оформлення</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {THEMES.map((t) => (
            <View key={t.value} style={{ flex: 1 }}>
              <CommandButton
                command={vm.setThemeCommand}
                param={t.value}
                title={t.label}
                variant={vm.theme.preference === t.value ? 'primary' : 'secondary'}
              />
            </View>
          ))}
        </View>
        <Text style={{ color: c.textMuted, fontSize: 12 }}>Вибір зберігається між запусками (Preferences).</Text>
      </Card>

      <SectionTitle>Синхронізація</SectionTitle>
      <Card>
        <Row label="Мережа" value={vm.sync.isOnline ? 'онлайн' : 'офлайн'} />
        <Row label="API" value={vm.sync.apiUrl} />
        <Row label="Змін у черзі" value={String(vm.sync.pendingCount)} />
        <Row label="Остання синхронізація" value={time(vm.sync.lastSyncAt)} />
        {vm.sync.lastError && <Text style={{ color: c.danger }}>{vm.sync.lastError}</Text>}
        <CommandButton command={vm.syncNowCommand} title={vm.sync.isSyncing ? 'Синхронізація…' : 'Синхронізувати зараз'} />
      </Card>

      <SectionTitle>Сесія та життєвий цикл</SectionTitle>
      <Card>
        <Row label="Поточний маршрут" value={vm.appState.currentRoute} />
        <Row label="Переглядів екранів" value={String(vm.appState.screenViews)} />
        <Row label="Тривалість сесії" value={vm.sessionDuration} />
        <View style={{ gap: 2 }}>
          {vm.lifecycle.history.slice(0, 8).map((h, i) => (
            <Text key={i} style={{ color: c.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] }}>
              {new Date(h.at).toLocaleTimeString()} · {h.event}
            </Text>
          ))}
        </View>
      </Card>

      <SectionTitle>Діагностика</SectionTitle>
      <Card>
        <CommandButton command={vm.openLogsCommand} title="Журнал подій" variant="secondary" />
        <CommandButton command={vm.simulateRejectionCommand} title="Необроблений виняток у фоновій задачі" variant="secondary" />
        <CommandButton command={vm.simulateExceptionCommand} title="Необроблений виняток (JS)" variant="danger" />
        <CommandButton command={vm.nativeCrashCommand} title="Нативний краш (Sentry)" variant="danger" />
        {!vm.crashReportingEnabled && (
          <Text style={{ color: c.textMuted, fontSize: 12 }}>
            Задайте EXPO_PUBLIC_SENTRY_DSN у .env, щоб увімкнути збір крашів.
          </Text>
        )}
      </Card>
    </ScrollView>
  );
}
