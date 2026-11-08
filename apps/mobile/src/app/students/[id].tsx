import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Slider from '@react-native-community/slider';
import { Services, container } from '../../AppServices';
import { bindText } from '../../core/mvvm/hooks';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { Badge, Card, CommandButton, Field, Row, SectionTitle } from '../../components/ui';
import { spacing, usePalette } from '../../theme/theme';

/**
 * StudentDetailPage.
 *
 * Параметри приходять двома шляхами:
 *  - з головної сторінки: об'єкт Student у словнику параметрів → applyQueryAttributes;
 *  - за deep link studenthub://students/<id>: лише id у URI → loadById (аналог [QueryProperty]).
 */
export default function StudentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vm = usePageViewModel(Services.StudentDetailViewModel);
  const c = usePalette();

  useEffect(() => {
    if (!id) return;
    const params = container.get(Services.Navigation).takeParams(`/students/${id}`);
    if (params) vm.applyQueryAttributes(params);
    else void vm.loadById(id);
  }, [id, vm]);

  if (vm.notFound) {
    return (
      <View style={{ padding: spacing.xl, gap: spacing.lg }}>
        <Text style={{ color: c.text, fontSize: 16 }}>Студента з id «{id}» не знайдено.</Text>
        <CommandButton command={vm.goBackCommand} title="Назад" variant="secondary" />
      </View>
    );
  }

  if (!vm.id) {
    return <ActivityIndicator style={{ marginTop: spacing.xl }} color={c.primary} />;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: vm.fullName }} />

      <Card>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{vm.fullName}</Text>
        <Row label="Група" value={vm.group || '—'} />
        <Row
          label="Середній бал"
          value={<Badge text={vm.averageScore.toFixed(1)} tone={vm.isExcellent ? 'success' : 'muted'} />}
        />
        <Row
          label="Документ"
          value={
            <Pressable onPress={() => vm.toggleDocumentCommand.execute()} accessibilityRole="button">
              <Text style={{ color: c.primary, fontWeight: '500' }}>{vm.documentNumberDisplay}</Text>
            </Pressable>
          }
        />
        <Text style={{ color: c.textMuted, fontSize: 12 }}>
          Deep link: studenthub://students/{vm.id}
        </Text>
      </Card>

      <SectionTitle>Редагування</SectionTitle>
      <Card>
        <Field label="Група" {...bindText(vm, 'group')} autoCapitalize="characters" />
        <Field label="Номер документа" {...bindText(vm, 'documentNumber')} autoCapitalize="characters" />
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
        {vm.validationError && <Text style={{ color: c.danger }}>{vm.validationError}</Text>}
        <CommandButton command={vm.saveCommand} title="Зберегти" />
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <CommandButton command={vm.goBackCommand} title="Назад" variant="secondary" />
        </View>
        <View style={{ flex: 1 }}>
          <CommandButton command={vm.deleteCommand} title="Видалити" variant="danger" />
        </View>
      </View>
    </ScrollView>
  );
}
