import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { bindText, useObservables, useViewModel } from '../core/mvvm/hooks';
import { Badge, Card, CommandButton, Field, SectionTitle } from '../components/ui';
import { isExcellent, type Student } from '../models/Student';
import { StudentViewModel } from '../viewmodels/StudentViewModel';
import { spacing, usePalette } from '../theme/theme';

/**
 * MainPage (View).
 * "BindingContext" = екземпляр StudentViewModel; компонент лише відображає його властивості
 * і викликає команди — жодного ручного звернення до елементів UI.
 */
export default function MainPage() {
  const [viewModel] = useState(() => new StudentViewModel());
  const vm = useViewModel(viewModel); // підписка на PropertyChanged
  useObservables(vm.students); // підписка на CollectionChanged
  const c = usePalette();

  const header = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      <Card>
        {/* Mode=TwoWay */}
        <Field label="ПІБ студента" placeholder="Іваненко Іван Іванович" {...bindText(vm, 'fullName')} />
        <Field label="Група" placeholder="ІПЗ-21" autoCapitalize="characters" {...bindText(vm, 'group')} />
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: c.textMuted, fontSize: 13 }}>Середній бал: {vm.averageScore.toFixed(1)}</Text>
          <Slider
            minimumValue={0}
            maximumValue={5}
            step={0.1}
            value={vm.averageScore}
            onValueChange={(v) => (vm.averageScore = v)}
            minimumTrackTintColor={c.primary}
            maximumTrackTintColor={c.border}
            thumbTintColor={c.primary}
          />
        </View>

        {/* Mode=OneWay + візуальна індикація AverageScore ≥ 4.0 */}
        <Text style={[styles.greeting, { color: vm.isExcellent ? c.success : c.text }]}>{vm.greeting}</Text>

        {/* Command="{Binding AddStudentCommand}" — блокується, поки ПІБ порожнє */}
        <CommandButton command={vm.addStudentCommand} title="Додати студента" />
      </Card>

      <SectionTitle>Студенти ({vm.students.count})</SectionTitle>
    </View>
  );

  return (
    <FlatList
      data={vm.students.items}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
          Список порожній — додайте першого студента
        </Text>
      }
      renderItem={({ item }) => <StudentItem student={item} />}
    />
  );
}

/** ItemTemplate / DataTemplate елемента списку. */
function StudentItem({ student }: { student: Student }) {
  const c = usePalette();
  return (
    <Card>
      <View style={styles.itemRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{student.fullName}</Text>
          <Text style={{ color: c.textMuted }}>{student.group || 'без групи'}</Text>
        </View>
        <Badge text={student.averageScore.toFixed(1)} tone={isExcellent(student) ? 'success' : 'muted'} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 16, fontWeight: '600' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
