import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Services } from '../AppServices';
import { usePageViewModel } from '../core/mvvm/usePageViewModel';
import { Badge, Banner, Card, Chip, CommandButton, MenuItem, SectionTitle, ToggleRow } from '../components/ui';
import type { ThemePreference } from '../services/ThemeService';
import { spacing, usePalette } from '../theme/theme';

const THEMES: { value: ThemePreference; label: string; icon: 'phone-portrait-outline' | 'sunny-outline' | 'moon-outline' }[] = [
  { value: 'system', label: 'Авто', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Світла', icon: 'sunny-outline' },
  { value: 'dark', label: 'Темна', icon: 'moon-outline' },
];
const LEADS = [5, 10, 15, 30];

export default function PreferencesPage() {
  const vm = usePageViewModel(Services.ProfileViewModel);
  const c = usePalette();
  const r = vm.reminders.settings;
  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}>
        {/* Нагадування */}
        <SectionTitle right={vm.reminders.permission === 'granted' ? <Badge text={`${vm.reminders.scheduledCount} заплан.`} tone="success" icon="notifications" /> : null}>
          Нагадування
        </SectionTitle>
        {vm.reminders.permission !== 'granted' ? (
          <Card style={{ backgroundColor: c.accentSoft }}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>Увімкніть сповіщення</Text>
            <Text style={{ color: c.textMuted, fontSize: 14, lineHeight: 20 }}>
              Нагадаємо про пару, подію або дедлайн завдання. Без дозволу сповіщення не приходитимуть.
            </Text>
            <CommandButton
              command={vm.fixPermissionCommand}
              title={vm.reminders.permission === 'denied' ? 'Відкрити налаштування' : 'Дозволити сповіщення'}
              icon="notifications-outline"
              variant="accent"
              compact
            />
          </Card>
        ) : null}
        <Card style={{ paddingVertical: spacing.xs }}>
          <ToggleRow icon="school-outline" title="Перед парою" subtitle={`за ${r.lessonLeadMin} хв до початку`} value={r.lessons} onChange={() => vm.toggleReminderCommand.execute('lessons')} />
          {r.lessons ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.leads}>
              {LEADS.map((m) => (
                <Chip key={m} command={vm.setLeadCommand} param={m} label={`${m} хв`} selected={r.lessonLeadMin === m} />
              ))}
            </Animated.View>
          ) : null}
          <ToggleRow icon="checkbox-outline" title="Дедлайни" subtitle="напередодні о 18:00" value={r.deadlines} onChange={() => vm.toggleReminderCommand.execute('deadlines')} />
          <ToggleRow icon="calendar-outline" title="Мої події" subtitle="за 15 хв до початку" value={r.events} onChange={() => vm.toggleReminderCommand.execute('events')} last />
        </Card>
        <CommandButton command={vm.testNotificationCommand} title="Надіслати тестове сповіщення" icon="paper-plane-outline" variant="secondary" />

        <SectionTitle>Тема</SectionTitle>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {THEMES.map((t) => (
            <Chip key={t.value} command={vm.setThemeCommand} param={t.value} label={t.label} icon={t.icon} selected={vm.theme.preference === t.value} />
          ))}
        </View>

        <SectionTitle>Інше</SectionTitle>
        <Card style={{ paddingVertical: spacing.xs }}>
          <MenuItem command={vm.syncCommand} icon="sync-outline" title={vm.sync.isSyncing ? 'Синхронізація…' : 'Синхронізувати зараз'} />
          <MenuItem command={vm.openDiagnosticsCommand} icon="pulse-outline" title="Синхронізація та діагностика" />
          <MenuItem command={vm.openLogsCommand} icon="document-text-outline" title="Журнал подій" last />
        </Card>
        <Card style={{ paddingVertical: spacing.xs }}>
          {vm.error ? <Banner text={vm.error} /> : null}
          <MenuItem command={vm.logoutCommand} icon="log-out-outline" title="Вийти з акаунта" danger last />
        </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  leads: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.md },
});
