import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { Services } from '../AppServices';
import { usePageViewModel } from '../core/mvvm/usePageViewModel';
import { Card, CommandButton, Field } from '../components/ui';
import { LOG_LEVEL_NAMES, LogLevel, type LogEntry } from '../core/logging/Logger';
import { spacing, usePalette, type Palette } from '../theme/theme';

const LEVELS = [LogLevel.Debug, LogLevel.Information, LogLevel.Warning, LogLevel.Error];

const levelColor = (l: LogLevel, c: Palette) =>
  l >= LogLevel.Error ? c.danger : l === LogLevel.Warning ? c.warning : l === LogLevel.Information ? c.text : c.textMuted;

export default function LogsPage() {
  const vm = usePageViewModel(Services.LogsViewModel);
  const c = usePalette();
  const [comment, setComment] = useState('');

  return (
    <FlatList
      data={vm.entries}
      keyExtractor={(e, i) => `${e.t}-${i}`}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      refreshing={vm.isBusy}
      onRefresh={() => vm.loadCommand.execute()}
      ListHeaderComponent={
        <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {LEVELS.map((l) => (
              <View key={l} style={{ flex: 1 }}>
                <CommandButton
                  command={vm.setMinLevelCommand}
                  param={l}
                  title={`${LOG_LEVEL_NAMES[l]}+`}
                  variant={vm.minLevel === l ? 'primary' : 'secondary'}
                  compact
                />
              </View>
            ))}
          </View>
          <Text style={{ color: c.textMuted, fontSize: 12 }}>
            {vm.entries.length} записів · файли: {vm.fileNames.join(', ') || '—'}
          </Text>
          <Card>
            <Field label="Повідомити про помилку" placeholder="Що сталося?" value={comment} onChangeText={setComment} />
            <CommandButton command={vm.reportCommand} param={comment} title="Надіслати звіт" variant="secondary" />
            {vm.status && <Text style={{ color: c.textMuted, fontSize: 12 }}>{vm.status}</Text>}
          </Card>
          <CommandButton command={vm.clearCommand} title="Очистити логи" variant="danger" compact />
        </View>
      }
      renderItem={({ item }) => <LogItem entry={item} />}
    />
  );
}

function LogItem({ entry }: { entry: LogEntry }) {
  const c = usePalette();
  return (
    <View style={{ borderLeftWidth: 3, borderLeftColor: levelColor(entry.level, c), paddingLeft: spacing.sm, gap: 2 }}>
      <Text style={{ color: c.textMuted, fontSize: 11, fontVariant: ['tabular-nums'] }}>
        {new Date(entry.t).toLocaleString()} · {LOG_LEVEL_NAMES[entry.level]} · {entry.ctx}
      </Text>
      <Text style={{ color: levelColor(entry.level, c), fontSize: 14 }}>{entry.msg}</Text>
      {entry.props && <Text style={{ color: c.textMuted, fontSize: 12 }}>{JSON.stringify(entry.props)}</Text>}
      {entry.error && (
        <Text style={{ color: c.danger, fontSize: 12 }}>
          {entry.error.name}: {entry.error.message}
        </Text>
      )}
    </View>
  );
}
