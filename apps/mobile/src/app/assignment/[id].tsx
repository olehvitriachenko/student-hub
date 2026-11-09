import { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Services } from '../../AppServices';
import { bindText, useCommand } from '../../core/mvvm/hooks';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { Banner, Card, Chip, CommandButton, EmptyState, Field, Icon, SectionTitle } from '../../components/ui';
import { spacing, usePalette } from '../../theme/theme';
import { formatDate, relativeDue, WEEKDAYS_FULL } from '../../utils/format';
import type { AssignmentEditViewModel } from '../../viewmodels/AssignmentEditViewModel';

const QUICK_DUE = [
  { days: 0, label: 'Сьогодні' },
  { days: 1, label: 'Завтра' },
  { days: 3, label: '+3 дні' },
  { days: 7, label: 'Тиждень' },
];

/**
 * AssignmentPage (View): створення та редагування завдання.
 * Відкривається зі списку (об'єкт передається через IQueryAttributable) або за deep link:
 *   studenthub://assignment/<id>
 */
export default function AssignmentPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vm = usePageViewModel(Services.AssignmentEditViewModel);
  const c = usePalette();

  useEffect(() => {
    void vm.initialize(String(id));
  }, [vm, id]);

  if (vm.notFound) {
    return <EmptyState icon="search-outline" title="Завдання не знайдено" subtitle="Можливо, його видалили на іншому пристрої." />;
  }

  const due = relativeDue(vm.dueAt);
  const dueDate = new Date(vm.dueAt);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: vm.isNew ? 'Нове завдання' : 'Завдання' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">
        {!vm.isNew ? <CommandButton command={vm.focusCommand} title="Почати фокус-сесію" icon="timer-outline" variant="accent" /> : null}
        <Card>
          <Field label="Назва" icon="create-outline" placeholder="Наприклад, лабораторна №4" {...bindText(vm, 'title')} />
          <Field label="Нотатки (шифруються на пристрої)" placeholder="Що потрібно зробити…" multiline {...bindText(vm, 'description')} />
        </Card>

        <SectionTitle>Предмет</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {vm.subjects.map((s) => (
            <Chip key={s} command={vm.setSubjectCommand} param={s} label={s} selected={vm.subject === s} />
          ))}
        </View>

        <SectionTitle>Дедлайн</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <StepButton vm={vm} delta={-1} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>{formatDate(vm.dueAt)}</Text>
              <Text style={{ color: due.tone === 'danger' ? c.danger : c.textMuted, fontSize: 14 }}>
                {WEEKDAYS_FULL[dueDate.getDay()]} · {due.text}
              </Text>
            </View>
            <StepButton vm={vm} delta={1} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {QUICK_DUE.map((q) => (
              <Chip key={q.days} command={vm.setDueInDaysCommand} param={q.days} label={q.label} selected={false} />
            ))}
          </View>
        </Card>

        <SectionTitle>Статус</SectionTitle>
        <Card>
          <Pressable onPress={() => vm.toggleDoneCommand.execute()} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Icon name={vm.done ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={vm.done ? c.success : c.textMuted} />
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '500', flex: 1 }}>{vm.done ? 'Виконано' : 'Ще не виконано'}</Text>
          </Pressable>
          <Field label="Оцінка (0–100, необов’язково)" icon="star-outline" placeholder="—" keyboardType="decimal-pad" {...bindText(vm, 'gradeText')} />
        </Card>

        {vm.error ? <Banner text={vm.error} /> : null}

        <CommandButton command={vm.saveCommand} title={vm.isNew ? 'Створити завдання' : 'Зберегти зміни'} icon="checkmark" />
        {!vm.isNew ? <CommandButton command={vm.deleteCommand} title="Видалити" icon="trash-outline" variant="danger" /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StepButton({ vm, delta }: { vm: AssignmentEditViewModel; delta: number }) {
  const { onPress } = useCommand(vm.shiftDueCommand, delta);
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: c.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
      accessibilityLabel={delta < 0 ? 'На день раніше' : 'На день пізніше'}
    >
      <Icon name={delta < 0 ? 'chevron-back' : 'chevron-forward'} size={20} color={c.primary} />
    </Pressable>
  );
}
