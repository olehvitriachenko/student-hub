import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Slider from '@react-native-community/slider';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { Badge, Card, CommandButton, Row, SectionTitle } from '../../components/ui';
import { messenger, navigation } from '../../services/instances';
import { StudentDetailViewModel } from '../../viewmodels/StudentDetailViewModel';
import { spacing, usePalette } from '../../theme/theme';

/** StudentDetailPage: дані обраного студента + редагування середнього балу. */
export default function StudentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vm = usePageViewModel(() => new StudentDetailViewModel(navigation, messenger));
  const c = usePalette();

  useEffect(() => {
    // Параметри, передані через GoToAsync(route, parameters) → IQueryAttributable.
    const params = navigation.takeParams(`/students/${id}`);
    if (params) vm.applyQueryAttributes(params);
  }, [id, vm]);

  if (!vm.id) {
    return <ActivityIndicator style={{ marginTop: spacing.xl }} color={c.primary} />;
  }

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Stack.Screen options={{ title: vm.fullName }} />

      <Card>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>{vm.fullName}</Text>
        <Row label="Група" value={vm.group || '—'} />
        <Row
          label="Середній бал"
          value={<Badge text={vm.averageScore.toFixed(1)} tone={vm.isExcellent ? 'success' : 'muted'} />}
        />
      </Card>

      <SectionTitle>Редагування</SectionTitle>
      <Card>
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

      <CommandButton command={vm.goBackCommand} title="Назад" variant="secondary" />
    </ScrollView>
  );
}
