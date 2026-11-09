import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect } from 'react';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Services } from '../../AppServices';
import { bindText } from '../../core/mvvm/hooks';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { Avatar, Badge, Banner, Card, Chip, CommandButton, Field, MenuItem, Row, ScreenHeader, SectionTitle, ToggleRow } from '../../components/ui';
import type { ThemePreference } from '../../services/ThemeService';
import { radius, spacing, TAB_BAR_SPACE, usePalette, usePastel } from '../../theme/theme';
import { formatDate } from '../../utils/format';

const THEMES: { value: ThemePreference; label: string; icon: 'phone-portrait-outline' | 'sunny-outline' | 'moon-outline' }[] = [
  { value: 'system', label: 'Авто', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Світла', icon: 'sunny-outline' },
  { value: 'dark', label: 'Темна', icon: 'moon-outline' },
];

const LEADS = [5, 10, 15, 30];

/** ProfilePage (View): картка студента, прогрес, нагадування, особисті дані, тема, вихід. */
export default function ProfilePage() {
  const vm = usePageViewModel(Services.ProfileViewModel);
  const c = usePalette();
  const user = vm.user;
  const s = vm.stats;
  const r = vm.reminders.settings;
  if (!user) return null;

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + spacing.xl }} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Профіль" />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        {/* Студентський квиток */}
        <Animated.View entering={FadeIn.duration(220)} style={[styles.idCard, { backgroundColor: c.ink }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <Avatar text={vm.initials} size={64} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: c.inkText, fontSize: 21, fontWeight: '800', letterSpacing: -0.5 }} numberOfLines={2}>
                {user.fullName}
              </Text>
              <Text style={{ color: c.inkMuted, fontSize: 14 }} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
          </View>
          <View style={styles.idFooter}>
            <IdField label="Група" value={user.group} />
            <IdField label="Студентський" value={user.studentCard} />
            <IdField label="З нами з" value={formatDate(user.createdAt)} />
          </View>
        </Animated.View>

        {/* Прогрес */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>Прогрес семестру</Text>
              <Text style={{ color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -1 }}>{Math.round(s.progress * 100)}%</Text>
            </View>
            <Badge text={`сер. бал ${s.average}`} tone="accent" icon="star" />
          </View>
          <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
            <View style={[styles.fill, { backgroundColor: c.accent, width: `${Math.max(4, Math.round(s.progress * 100))}%` }]} />
          </View>
          <Text style={{ color: c.textMuted, fontSize: 14 }}>
            Виконано {s.done} з {s.total}
            {s.overdue ? ` · прострочено ${s.overdue}` : ''}
          </Text>
        </Card>

        {/* Фокус + оцінки за предметами */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Card style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>Фокус сьогодні</Text>
            <Text style={{ color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -1 }}>{vm.focus.todayMin} хв</Text>
          </Card>
          <Card style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>Усього сесій</Text>
            <Text style={{ color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -1 }}>{vm.focus.stats.sessions}</Text>
          </Card>
        </View>

        {vm.gradesBySubject.length ? (
          <Card>
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>Оцінки за предметами</Text>
            {vm.gradesBySubject.map((g, i) => (
              <GradeBar key={g.subject} subject={g.subject} value={g.average} index={i} />
            ))}
          </Card>
        ) : null}

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

        {/* Особисті дані */}
        <SectionTitle right={!vm.isEditing ? <CommandButton command={vm.startEditCommand} title="Змінити" icon="create-outline" variant="secondary" compact /> : null}>
          Особисті дані
        </SectionTitle>
        <Card>
          {vm.isEditing ? (
            <Animated.View entering={FadeIn.duration(220)} style={{ gap: spacing.md }}>
              <Field label="Прізвище та ім’я" icon="person-outline" {...bindText(vm, 'editFullName')} />
              <Field label="Група" icon="people-outline" autoCapitalize="characters" {...bindText(vm, 'editGroup')} />
              {vm.error ? <Banner text={vm.error} /> : null}
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <CommandButton command={vm.cancelEditCommand} title="Скасувати" variant="secondary" style={{ flex: 1 }} />
                <CommandButton command={vm.saveProfileCommand} title="Зберегти" style={{ flex: 1 }} />
              </View>
            </Animated.View>
          ) : (
            <>
              <Row icon="person-outline" label="ПІБ" value={user.fullName} />
              <Row icon="people-outline" label="Група" value={user.group} />
              <Row icon="mail-outline" label="Email" value={user.email} />
            </>
          )}
        </Card>

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
          <MenuItem command={vm.openLogsCommand} icon="document-text-outline" title="Журнал подій" />
          <MenuItem command={vm.logoutCommand} icon="log-out-outline" title="Вийти з акаунта" danger last />
        </Card>
      </View>
    </ScrollView>
  );
}

/** Горизонтальна смуга графіка: ширина плавно «доростає» до значення при появі. */
function GradeBar({ subject, value, index }: { subject: string; value: number; index: number }) {
  const c = usePalette();
  const pastel = usePastel()(subject);
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(index * 80, withTiming(value, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [value, index, w]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
          {subject}
        </Text>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '800' }}>{Math.round(value)}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.surfaceAlt, height: 10 }]}>
        <Animated.View style={[styles.fill, { backgroundColor: pastel.fg }, bar]} />
      </View>
    </View>
  );
}

function IdField({ label, value }: { label: string; value: string }) {
  const c = usePalette();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: c.inkMuted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: c.inkText, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  idCard: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.xl, overflow: 'hidden' },
  idFooter: { flexDirection: 'row', gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#3A3842', paddingTop: spacing.lg },
  track: { height: 12, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  leads: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.md },
});
