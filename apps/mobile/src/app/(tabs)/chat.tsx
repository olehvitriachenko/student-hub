import { useEffect, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Services } from '../../AppServices';
import { bindText, useObservables } from '../../core/mvvm/hooks';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { Badge, CommandButton, EmptyState, IconButton, PressableScale, ScreenHeader } from '../../components/ui';
import { REACTIONS } from '../../models/ChatMessage';
import { haptic } from '../../utils/haptics';
import type { ChatRow, ChatViewModel } from '../../viewmodels/ChatViewModel';
import { radius, spacing, TAB_BAR_SPACE, usePalette, usePastel } from '../../theme/theme';
import { initials } from '../../utils/format';

const time = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** ChatPage (View): чат групи через WebSocket. */
export default function ChatPage() {
  const vm = usePageViewModel(Services.ChatViewModel);
  useObservables(vm.chat, vm.chat.messages);
  const c = usePalette();
  const keyboard = useKeyboardVisible();
  const status = vm.chat.status;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        subtitle={`Група ${vm.room}`}
        title="Чат"
        right={
          <Badge
            text={vm.statusText}
            tone={status === 'online' ? (vm.chat.typing ? 'accent' : 'success') : status === 'connecting' ? 'warning' : 'danger'}
            icon={status === 'online' ? 'ellipse' : status === 'connecting' ? 'sync' : 'cloud-offline-outline'}
          />
        }
      />

      <FlatList
        style={{ flex: 1 }}
        data={vm.rows}
        inverted
        keyExtractor={(r) => r.key}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 4, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={{ flex: 1, justifyContent: 'center', transform: [{ scaleY: -1 }] }}>
            <EmptyState icon="chatbubbles-outline" title="Тут поки тихо" subtitle="Напишіть першим — повідомлення побачить уся група." />
          </View>
        }
        onScrollBeginDrag={() => vm.closeReactionsCommand.execute()}
        renderItem={({ item }) => <Row row={item} vm={vm} />}
      />

      {status === 'offline' ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
          <CommandButton command={vm.reconnectCommand} title="Перепідключитися" icon="refresh" variant="secondary" compact />
        </View>
      ) : null}

      <View style={[styles.inputBar, { paddingBottom: keyboard ? spacing.sm : TAB_BAR_SPACE - spacing.md }]}>
        <View style={[styles.inputWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TextInput
            placeholder="Повідомлення…"
            placeholderTextColor={c.textMuted}
            selectionColor={c.accent}
            multiline
            maxLength={1000}
            style={[styles.input, { color: c.text }]}
            {...bindText(vm, 'draft')}
          />
        </View>
        <IconButton command={vm.sendCommand} icon="arrow-up" tone="accent" />
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ row, vm }: { row: ChatRow; vm: ChatViewModel }) {
  const c = usePalette();
  const pastel = usePastel();
  if (row.kind === 'day') {
    return (
      <View style={styles.dayWrap}>
        <View style={[styles.day, { backgroundColor: c.surfaceAlt }]}>
          <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '700' }}>{row.label}</Text>
        </View>
      </View>
    );
  }
  const { message: m, mine, showAuthor, showAvatar, reactions } = row;
  const color = pastel(m.userId);
  const picking = vm.reactingTo === m.id;
  const react = (emoji: string) => {
    haptic.select();
    vm.reactCommand.execute({ messageId: m.id, emoji });
  };

  return (
    <Animated.View entering={FadeIn.duration(180)} style={{ marginTop: showAuthor ? spacing.sm : 0, alignItems: mine ? 'flex-end' : 'flex-start' }}>
      {picking ? (
        <Animated.View entering={FadeIn.duration(150)} style={[styles.picker, { backgroundColor: c.surface, shadowColor: c.shadow }, !mine && { marginLeft: 38 }]}>
          {REACTIONS.map((e) => (
            <PressableScale key={e} onPress={() => react(e)} scaleTo={0.85} style={styles.pickerItem}>
              <Text style={{ fontSize: 26 }}>{e}</Text>
            </PressableScale>
          ))}
        </Animated.View>
      ) : null}
      <View style={[styles.msgRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
        {!mine ? (
          <View style={[styles.avatar, { backgroundColor: showAvatar ? color.bg : c.background }]}>
            {showAvatar ? <Text style={{ color: color.fg, fontWeight: '800', fontSize: 12 }}>{initials(m.author)}</Text> : null}
          </View>
        ) : null}
        <Pressable
          onLongPress={() => {
            haptic.heavy();
            vm.openReactionsCommand.execute(m.id);
          }}
          onPress={() => (vm.reactingTo ? vm.closeReactionsCommand.execute() : undefined)}
          delayLongPress={280}
          style={({ pressed }) => [
            styles.bubble,
            mine ? { backgroundColor: c.primary, borderBottomRightRadius: 6 } : { backgroundColor: c.surface, borderBottomLeftRadius: 6 },
            (pressed || picking) && { transform: [{ scale: 0.98 }] },
          ]}
        >
          {!mine && showAuthor ? <Text style={{ color: color.fg, fontWeight: '700', fontSize: 13, marginBottom: 2 }}>{m.author}</Text> : null}
          <Text style={{ color: mine ? c.primaryText : c.text, fontSize: 16, lineHeight: 21 }}>{m.text}</Text>
          <Text style={{ color: mine ? c.tabInactive : c.textMuted, fontSize: 11, alignSelf: 'flex-end', marginTop: 2 }}>{time(m.createdAt)}</Text>
        </Pressable>
      </View>
      {reactions.length ? (
        <View style={[styles.reactions, !mine && { marginLeft: 38 }]}>
          {reactions.map((r) => (
            <PressableScale
              key={r.emoji}
              onPress={() => react(r.emoji)}
              style={[styles.reaction, { backgroundColor: r.mine ? c.accentSoft : c.surface, borderColor: r.mine ? c.accent : c.border }]}
            >
              <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
              <Text style={{ color: r.mine ? c.accent : c.text, fontWeight: '700', fontSize: 13 }}>{r.count}</Text>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Стан клавіатури — суто UI: щоб поле вводу не висіло над нею на висоті таб-бару. */
function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

const styles = StyleSheet.create({
  dayWrap: { alignItems: 'center', marginVertical: spacing.sm },
  day: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  picker: {
    flexDirection: 'row',
    gap: 2,
    padding: 6,
    borderRadius: radius.pill,
    marginBottom: 6,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  pickerItem: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  inputWrap: { flex: 1, borderRadius: 24, borderWidth: 1, paddingHorizontal: spacing.lg, minHeight: 44, justifyContent: 'center' },
  input: { fontSize: 16, maxHeight: 120, paddingTop: 11, paddingBottom: 11 },
});
