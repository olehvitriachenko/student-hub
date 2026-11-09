import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, LinearTransition, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { haptic } from '../../utils/haptics';
import { Services } from '../../AppServices';
import { useCommand, useObservables } from '../../core/mvvm/hooks';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { Badge, Card, Chip, EmptyState, FadeInItem, Icon, PressableScale, ScreenHeader, Snackbar, Tag } from '../../components/ui';
import type { Assignment } from '../../models/Assignment';
import { radius, spacing, TAB_BAR_SPACE, usePalette, usePastel } from '../../theme/theme';
import { formatDate, relativeDue } from '../../utils/format';
import type { AssignmentFilter, AssignmentsViewModel } from '../../viewmodels/AssignmentsViewModel';

/** AssignmentsPage (View): статистика, фільтр, список завдань (ObservableCollection), кнопка додавання. */
export default function AssignmentsPage() {
  const vm = usePageViewModel(Services.AssignmentsViewModel);
  useObservables(vm.items, vm.sync); // CollectionChanged + стан синхронізації
  const c = usePalette();
  const insets = useSafeAreaInsets();

  const filters: { value: AssignmentFilter; label: string }[] = [
    { value: 'active', label: `Активні ${vm.activeCount}` },
    { value: 'done', label: `Виконані ${vm.doneCount}` },
    { value: 'all', label: 'Усі' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Animated.FlatList
        data={vm.visible}
        keyExtractor={(a) => a.id}
        itemLayoutAnimation={LinearTransition.duration(200)}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: TAB_BAR_SPACE + 80, gap: spacing.md }}
        refreshing={vm.isBusy}
        onRefresh={() => vm.refreshCommand.execute()}
        ListHeaderComponent={
          <View style={{ marginHorizontal: -spacing.lg, gap: spacing.lg, marginBottom: spacing.xs }}>
            <ScreenHeader title="Завдання" subtitle="Дедлайни та оцінки" right={<SyncIndicator online={vm.sync.isOnline} syncing={vm.sync.isSyncing} pending={vm.sync.pendingCount} />} />
            <View style={styles.stats}>
              <Stat value={vm.activeCount} label="активних" tone="ink" />
              <Stat value={vm.overdueCount} label="прострочено" tone={vm.overdueCount ? 'danger' : 'plain'} />
              <Stat value={vm.doneCount} label="виконано" tone="plain" />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
              {filters.map((f) => (
                <Chip key={f.value} command={vm.setFilterCommand} param={f.value} label={f.label} selected={vm.filter === f.value} />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          vm.filter === 'done' ? (
            <EmptyState icon="trophy-outline" title="Ще нічого не виконано" subtitle="Відмічайте завдання — вони з’являться тут." />
          ) : (
            <EmptyState icon="sparkles-outline" title="Усе зроблено!" subtitle="Натисніть «+», щоб додати нове завдання." />
          )
        }
        renderItem={({ item, index }) => (
          <FadeInItem index={index}>
            <AssignmentCard vm={vm} item={item} />
          </FadeInItem>
        )}
      />
      <View style={[styles.fab, { bottom: Math.max(insets.bottom - 6, spacing.lg) + 72 }]}>
        <Fab vm={vm} />
      </View>
      {vm.undoText ? <Snackbar text={vm.undoText} actionLabel="Скасувати" command={vm.undoDeleteCommand} /> : null}
    </View>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: 'ink' | 'danger' | 'plain' }) {
  const c = usePalette();
  const bg = tone === 'ink' ? c.ink : tone === 'danger' ? c.dangerBg : c.surface;
  const fg = tone === 'ink' ? c.inkText : tone === 'danger' ? c.danger : c.text;
  const sub = tone === 'ink' ? c.inkMuted : tone === 'danger' ? c.danger : c.textMuted;
  return (
    <View style={[styles.stat, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 28, fontWeight: '800', letterSpacing: -1 }}>{value}</Text>
      <Text style={{ color: sub, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function Fab({ vm }: { vm: AssignmentsViewModel }) {
  const { onPress } = useCommand(vm.addCommand, undefined);
  const c = usePalette();
  return (
    <PressableScale onPress={onPress} accessibilityLabel="Додати завдання" scaleTo={0.9} style={[styles.fabButton, { backgroundColor: c.accent, shadowColor: c.accent }]}>
      <Icon name="add" size={30} color={c.accentText} />
    </PressableScale>
  );
}

/** Чекбокс «виконано». */
function CheckCircle({ done, onPress }: { done: boolean; onPress: () => void }) {
  const c = usePalette();
  return (
    <PressableScale onPress={onPress} hitSlop={12} accessibilityRole="checkbox" accessibilityState={{ checked: done }}>
      <View style={[styles.check, { borderColor: done ? c.success : c.border, backgroundColor: done ? c.success : c.surface }]}>
        {done ? <Icon name="checkmark" size={17} color="#fff" /> : null}
      </View>
    </PressableScale>
  );
}

/**
 * DataTemplate елемента списку зі свайпами:
 *  → вправо — «Виконано» (спрацьовує одразу),
 *  ← вліво — кнопки «Фокус» і «Видалити».
 */
function AssignmentCard({ vm, item }: { vm: AssignmentsViewModel; item: Assignment }) {
  const c = usePalette();
  const pastel = usePastel()(item.subject);
  const toggle = useCommand(vm.toggleDoneCommand, item);
  const open = useCommand(vm.openCommand, item);
  const remove = useCommand(vm.deleteCommand, item);
  const focus = useCommand(vm.focusCommand, item);
  const due = relativeDue(item.dueAt);
  const swipe = useRef<SwipeableMethods>(null);

  return (
    <Animated.View exiting={FadeOut.duration(150)}>
      <ReanimatedSwipeable
        ref={swipe}
        friction={1.6}
        leftThreshold={70}
        rightThreshold={50}
        overshootLeft={false}
        overshootRight={false}
        containerStyle={{ borderRadius: radius.lg }}
        renderLeftActions={(_p, translation) => <LeftAction translation={translation} done={item.done} />}
        renderRightActions={(_p, _t, methods) => (
          <View style={styles.swipeRight}>
            <PressableScale
              onPress={() => {
                methods.close();
                focus.onPress();
              }}
              style={[styles.swipeBtn, { backgroundColor: c.ink }]}
            >
              <Icon name="timer-outline" size={22} color={c.inkText} />
              <Text style={[styles.swipeText, { color: c.inkText }]}>Фокус</Text>
            </PressableScale>
            <PressableScale
              onPress={() => {
                haptic.warning();
                remove.onPress();
              }}
              style={[styles.swipeBtn, { backgroundColor: c.danger }]}
            >
              <Icon name="trash-outline" size={22} color="#fff" />
              <Text style={styles.swipeText}>Видалити</Text>
            </PressableScale>
          </View>
        )}
        onSwipeableOpen={(direction) => {
          // direction — напрямок жесту: свайп вправо (RIGHT) відкриває ліву панель → одразу відмічаємо.
          if (direction === SwipeDirection.RIGHT) {
            haptic.success();
            swipe.current?.close();
            toggle.onPress();
          } else {
            haptic.tap();
          }
        }}
      >
        <Card onPress={open.onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <CheckCircle
            done={item.done}
            onPress={() => {
              if (!item.done) haptic.success();
              toggle.onPress();
            }}
          />
          <View style={{ flex: 1, gap: 8 }}>
            <Tag text={item.subject} bg={pastel.bg} fg={pastel.fg} />
            <Text
              style={{ fontSize: 17, fontWeight: '700', letterSpacing: -0.3, textDecorationLine: item.done ? 'line-through' : 'none', color: item.done ? c.textMuted : c.text }}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {item.done ? (
                <Badge text={`здано ${formatDate(item.dueAt)}`} tone="success" icon="checkmark-circle" />
              ) : (
                <Badge text={`${formatDate(item.dueAt)} · ${due.text}`} tone={due.tone} icon="time-outline" />
              )}
              {item.grade !== null ? <Badge text={`${item.grade} балів`} tone="ink" icon="star" /> : null}
            </View>
          </View>
          <Icon name="chevron-forward" size={18} color={c.textMuted} />
        </Card>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

/** Ліва панель свайпу видима лише коли картку тягнуть вправо (не просвічує під правими кнопками). */
function LeftAction({ translation, done }: { translation: SharedValue<number>; done: boolean }) {
  const c = usePalette();
  const style = useAnimatedStyle(() => ({ opacity: translation.value > 0 ? 1 : 0 }));
  return (
    <Animated.View style={[styles.swipeLeft, { backgroundColor: done ? c.warning : c.success }, style]}>
      <Icon name={done ? 'arrow-undo' : 'checkmark-done'} size={24} color="#fff" />
      <Text style={styles.swipeText}>{done ? 'Повернути' : 'Виконано'}</Text>
    </Animated.View>
  );
}

function SyncIndicator({ online, syncing, pending }: { online: boolean; syncing: boolean; pending: number }) {
  if (syncing) return <Badge text="синхр." tone="warning" icon="sync" />;
  if (!online) return <Badge text={pending ? `офлайн · ${pending}` : 'офлайн'} tone="danger" icon="cloud-offline-outline" />;
  if (pending) return <Badge text={`${pending} в черзі`} tone="warning" icon="cloud-upload-outline" />;
  return <Badge text="синхронізовано" tone="success" icon="cloud-done-outline" />;
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  stat: { flex: 1, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: 0 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: spacing.lg },
  swipeLeft: { flex: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.xl, gap: spacing.sm, marginRight: -radius.lg },
  swipeRight: { flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.sm },
  swipeBtn: { width: 84, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 4 },
  swipeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  fabButton: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
});
