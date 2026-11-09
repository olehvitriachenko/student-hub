import { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Services } from '../../AppServices';
import { bindText, useCommand } from '../../core/mvvm/hooks';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { Banner, Card, Chip, CommandButton, EmptyState, Field, Icon, PressableScale, SectionTitle, ToggleRow, type IconName } from '../../components/ui';
import { EVENT_CATEGORIES } from '../../models/PlannerEvent';
import { radius, spacing, usePalette, usePastel } from '../../theme/theme';
import { formatDate, WEEKDAYS_FULL } from '../../utils/format';
import type { EventEditViewModel } from '../../viewmodels/EventEditViewModel';

const DURATIONS = [30, 60, 90, 120];
const hhmm = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** EventPage (View): створення / редагування події планувальника. Deep link: studenthub://event/<id> */
export default function EventPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vm = usePageViewModel(Services.EventEditViewModel);
  const c = usePalette();
  const pastel = usePastel()(vm.category);

  useEffect(() => {
    void vm.initialize(String(id));
  }, [vm, id]);

  if (vm.notFound) return <EmptyState icon="search-outline" title="Подію не знайдено" subtitle="Можливо, її вже видалено." />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: vm.isNew ? 'Нова подія' : 'Подія' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }} keyboardShouldPersistTaps="handled">
        {/* Прев'ю картки так, як вона буде в розкладі */}
        <Animated.View entering={FadeIn.duration(220)} style={[styles.preview, { backgroundColor: pastel.bg }]}>
          <Text style={{ color: pastel.fg, fontWeight: '700', fontSize: 14 }}>
            {WEEKDAYS_FULL[new Date(vm.startAt).getDay()]}, {formatDate(vm.startAt)} · {hhmm(vm.startAt)}–{hhmm(vm.endAt)}
          </Text>
          <Text style={{ color: '#16151C', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }} numberOfLines={2}>
            {vm.title || 'Назва події'}
          </Text>
        </Animated.View>

        <Field placeholder="Що плануєте? Напр., консультація з БД" icon="create-outline" {...bindText(vm, 'title')} />

        <SectionTitle>Категорія</SectionTitle>
        <View style={styles.wrap}>
          {EVENT_CATEGORIES.map((cat) => (
            <Chip key={cat.value} command={vm.setCategoryCommand} param={cat.value} label={cat.label} icon={cat.icon as IconName} selected={vm.category === cat.value} />
          ))}
        </View>

        <SectionTitle>Коли</SectionTitle>
        <Card>
          <Stepper vm={vm} label="День" value={`${formatDate(vm.startAt)}`} sub={WEEKDAYS_FULL[new Date(vm.startAt).getDay()]} command="day" />
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />
          <Stepper vm={vm} label="Початок" value={hhmm(vm.startAt)} sub="крок 15 хв" command="time" />
          <View style={styles.wrap}>
            {DURATIONS.map((m) => (
              <Chip key={m} command={vm.setDurationCommand} param={m} label={m < 60 ? `${m} хв` : `${m / 60} год`} selected={vm.durationMin === m} />
            ))}
          </View>
        </Card>

        <Card style={{ paddingVertical: spacing.xs }}>
          <ToggleRow icon="notifications-outline" title="Нагадати" subtitle="за 15 хв до початку" value={vm.remind} onChange={() => vm.toggleRemindCommand.execute()} last />
        </Card>

        <Field label="Нотатка (шифрується на пристрої)" placeholder="Деталі, посилання, аудиторія…" multiline {...bindText(vm, 'note')} />

        {vm.error ? <Banner text={vm.error} /> : null}
        <CommandButton command={vm.saveCommand} title={vm.isNew ? 'Додати в розклад' : 'Зберегти'} icon="checkmark" />
        {!vm.isNew ? <CommandButton command={vm.deleteCommand} title="Видалити подію" icon="trash-outline" variant="danger" /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stepper({ vm, label, value, sub, command }: { vm: EventEditViewModel; label: string; value: string; sub: string; command: 'day' | 'time' }) {
  const c = usePalette();
  const cmd = command === 'day' ? vm.shiftDayCommand : vm.shiftTimeCommand;
  const step = command === 'day' ? 1 : 15;
  const minus = useCommand(cmd, -step);
  const plus = useCommand(cmd, step);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 }}>{value}</Text>
        <Text style={{ color: c.textMuted, fontSize: 13 }}>{sub}</Text>
      </View>
      <PressableScale onPress={minus.onPress} style={[styles.step, { backgroundColor: c.surfaceAlt }]}>
        <Icon name="remove" size={20} />
      </PressableScale>
      <PressableScale onPress={plus.onPress} style={[styles.step, { backgroundColor: c.primary }]}>
        <Icon name="add" size={20} color={c.primaryText} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  step: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
