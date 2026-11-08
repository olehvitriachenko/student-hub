import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import Slider from '@react-native-community/slider';
import { Services } from '../AppServices';
import { bindText, useObservables } from '../core/mvvm/hooks';
import { usePageViewModel } from '../core/mvvm/usePageViewModel';
import { Badge, Card, CommandButton, Field, SectionTitle } from '../components/ui';
import { isExcellent, type Student } from '../models/Student';
import { spacing, usePalette } from '../theme/theme';

/**
 * MainPage (View): лише розмітка та прив'язки до StudentViewModel.
 * Жодної бізнес-логіки й прямого звернення до сервісів — усе через властивості та команди VM.
 */
export default function StudentListPage() {
  const vm = usePageViewModel(Services.StudentViewModel);
  useObservables(vm.students); // CollectionChanged
  const c = usePalette();

  const header = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      <Card>
        {/* TwoWay binding */}
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

        {/* OneWay binding + візуальна індикація AverageScore ≥ 4.0 */}
        <Text style={[styles.greeting, { color: vm.isExcellent ? c.success : c.text }]}>{vm.greeting}</Text>

        {/* Command binding: кнопка блокується, поки ПІБ порожнє (CanExecute) */}
        <CommandButton command={vm.addStudentCommand} title="Додати студента" />
      </Card>

      <SectionTitle>Студенти ({vm.students.count})</SectionTitle>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => <CommandButton command={vm.openSettingsCommand} title="⚙︎" variant="secondary" compact />,
        }}
      />
      <FlatList
        data={vm.students.items}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshing={vm.isBusy}
        onRefresh={() => vm.loadCommand.execute()}
        ListEmptyComponent={
          <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
            Список порожній — додайте першого студента
          </Text>
        }
        renderItem={({ item }) => (
          <StudentItem
            student={item}
            highlighted={item.id === vm.lastEditedId}
            onPress={() => vm.openDetailsCommand.execute(item)}
          />
        )}
      />
    </>
  );
}

/** DataTemplate елемента списку. */
function StudentItem({ student, highlighted, onPress }: { student: Student; highlighted: boolean; onPress: () => void }) {
  const c = usePalette();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint="Відкрити деталі студента">
      {({ pressed }) => (
        <Card style={{ opacity: pressed ? 0.85 : 1, borderColor: highlighted ? c.primary : c.border }}>
          <View style={styles.itemRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{student.fullName}</Text>
              <Text style={{ color: c.textMuted }}>{student.group || 'без групи'}</Text>
            </View>
            <Badge text={student.averageScore.toFixed(1)} tone={isExcellent(student) ? 'success' : 'muted'} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 16, fontWeight: '600' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
