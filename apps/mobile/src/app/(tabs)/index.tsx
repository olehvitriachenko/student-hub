import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { haptic } from '../../utils/haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Services } from '../../AppServices';
import { useCommand } from '../../core/mvvm/hooks';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { Badge, Banner, EmptyState, FadeInItem, Icon, IconButton, PressableScale, ScreenHeader, SectionTitle, Tag, type IconName } from '../../components/ui';
import { categoryOf } from '../../models/PlannerEvent';
import { radius, spacing, TAB_BAR_SPACE, usePalette, usePastel } from '../../theme/theme';
import type { ItemState, ScheduleViewModel, TimelineItem, WeekDay } from '../../viewmodels/ScheduleViewModel';

/** SchedulePage (View): тиждень, «зараз / далі», стрічка дня з парами та подіями, кнопка «+ подія». */
export default function SchedulePage() {
  const vm = usePageViewModel(Services.ScheduleViewModel);
  const c = usePalette();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_SPACE + spacing.xl }}
        refreshControl={<RefreshControl refreshing={vm.isBusy} onRefresh={() => vm.refreshCommand.execute()} tintColor={c.accent} />}
      >
        <ScreenHeader subtitle={vm.greetingText} title="Розклад" right={vm.group ? <Badge text={vm.group} tone="ink" icon="people" /> : null} />

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
          {vm.error ? <Banner text={vm.error} tone={vm.hasData ? 'warning' : 'danger'} /> : null}
          <NowCard vm={vm} />

          <View style={styles.weekHeader}>
            <IconButton command={vm.prevWeekCommand} icon="chevron-back" />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{vm.weekTitle}</Text>
              {!vm.isCurrentWeek ? (
                <PressableScale onPress={() => vm.todayCommand.execute()}>
                  <Text style={{ color: c.accent, fontWeight: '700', fontSize: 13, marginTop: 2 }}>До сьогодні</Text>
                </PressableScale>
              ) : (
                <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 2 }}>цей тиждень</Text>
              )}
            </View>
            <IconButton command={vm.nextWeekCommand} icon="chevron-forward" />
          </View>

          <View style={styles.week}>
            {vm.week.map((d) => (
              <DayPill key={d.date} vm={vm} day={d} selected={vm.selectedDate === d.date} />
            ))}
          </View>

          <SectionTitle right={<AddEventButton vm={vm} />}>{vm.selectedTitle}</SectionTitle>
          <Text style={{ color: c.textMuted, fontSize: 13, marginTop: -spacing.sm }}>← свайпніть, щоб перейти до іншого дня →</Text>

          <DaySwipe vm={vm}>
          {vm.items.length === 0 ? (
            <EmptyState icon="sunny-outline" title="Вільний день" subtitle="Пар немає. Додайте подію — консультацію, зустріч чи тренування." />
          ) : (
            <View style={{ gap: spacing.md }} key={vm.selectedDate}>
              {vm.items.map((item, i) => (
                <FadeInItem key={item.key} index={i}>
                  <TimelineRow vm={vm} item={item} state={vm.itemState(item)} />
                </FadeInItem>
              ))}
            </View>
          )}
          </DaySwipe>
        </View>
      </ScrollView>
    </View>
  );
}

/** Горизонтальний свайп по стрічці дня перемикає день (вертикальний скрол не заважає). */
function DaySwipe({ vm, children }: { vm: ScheduleViewModel; children: React.ReactNode }) {
  const pan = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-25, 25],
    failOffsetY: [-15, 15],
    onDeactivate: (e) => {
      if (Math.abs(e.translationX) < 60) return;
      haptic.select();
      vm.shiftDayCommand.execute(e.translationX < 0 ? 1 : -1);
    },
  });
  return (
    <GestureDetector gesture={pan}>
      <View style={{ gap: spacing.md, minHeight: 240 }}>{children}</View>
    </GestureDetector>
  );
}

/** Темна картка «Зараз / Далі». */
function NowCard({ vm }: { vm: ScheduleViewModel }) {
  const c = usePalette();
  const s = vm.todaySummary;
  const item = s.item;
  const title = item ? (item.kind === 'lesson' ? item.lesson.subject : item.event.title) : null;
  const meta = item
    ? item.kind === 'lesson'
      ? `${item.start}–${item.end} · ауд. ${item.lesson.room}`
      : `${item.start}–${item.end} · ${categoryOf(item.event.category).label}`
    : 'Перегляньте завдання або додайте подію';
  return (
    <Animated.View entering={FadeIn.duration(400)} style={[styles.now, { backgroundColor: c.ink }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={[styles.liveDot, { backgroundColor: item ? c.accent : c.success }]} />
        <Text style={{ color: c.inkMuted, fontSize: 14, fontWeight: '700' }}>{s.title}</Text>
      </View>
      <Text style={{ color: c.inkText, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 }} numberOfLines={2}>
        {title ?? 'Можна видихнути ✨'}
      </Text>
      <Text style={{ color: c.inkMuted, fontSize: 15, fontWeight: '500' }}>{meta}</Text>
    </Animated.View>
  );
}

function AddEventButton({ vm }: { vm: ScheduleViewModel }) {
  const { onPress } = useCommand(vm.addEventCommand, undefined);
  const c = usePalette();
  return (
    <PressableScale onPress={onPress} style={[styles.addBtn, { backgroundColor: c.primary }]}>
      <Icon name="add" size={18} color={c.primaryText} />
      <Text style={{ color: c.primaryText, fontWeight: '700', fontSize: 14 }}>Подія</Text>
    </PressableScale>
  );
}

function DayPill({ vm, day, selected }: { vm: ScheduleViewModel; day: WeekDay; selected: boolean }) {
  const { onPress } = useCommand(vm.selectDateCommand, day.date);
  const c = usePalette();
  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.dayPill,
        { backgroundColor: selected ? c.primary : c.surface, borderColor: day.isToday && !selected ? c.accent : 'transparent' },
      ]}
    >
      <Text style={{ color: selected ? c.primaryText : c.textMuted, fontSize: 12, fontWeight: '700' }}>{day.label}</Text>
      <Text style={{ color: selected ? c.primaryText : c.text, fontSize: 18, fontWeight: '800' }}>{day.dayOfMonth}</Text>
      <View style={styles.dots}>
        {Array.from({ length: Math.min(day.count, 4) }).map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: selected ? c.accent : c.textMuted }]} />
        ))}
      </View>
    </PressableScale>
  );
}

function TimelineRow({ vm, item, state }: { vm: ScheduleViewModel; item: TimelineItem; state: ItemState }) {
  const c = usePalette();
  const pastel = usePastel();
  const isEvent = item.kind === 'event';
  const base = pastel(isEvent ? item.event.category : item.lesson.subject);
  // Минулі пари — суцільна нейтральна картка замість прозорості.
  const color = state === 'past' ? { bg: c.surfaceAlt, fg: c.textMuted } : base;
  const open = useCommand(vm.openEventCommand, isEvent ? item.event : (null as never));

  const body = (
    <View style={[styles.itemCard, { backgroundColor: color.bg }, state === 'now' && { borderWidth: 2, borderColor: c.accent }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {isEvent ? (
          <Tag text={categoryOf(item.event.category).label} bg={c.surface} fg={color.fg} icon={categoryOf(item.event.category).icon as IconName} />
        ) : (
          <Tag text={item.lesson.type} bg={c.surface} fg={color.fg} icon={item.lesson.type === 'Лекція' ? 'mic-outline' : 'flask-outline'} />
        )}
        {state === 'now' ? <Badge text="зараз" tone="accent" icon="radio-button-on" /> : null}
        {isEvent && item.event.remind && state !== 'now' ? <Icon name="notifications" size={16} color={color.fg} /> : null}
      </View>
      <Text style={{ color: state === 'past' ? c.textMuted : '#16151C', fontSize: 18, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={2}>
        {isEvent ? item.event.title : item.lesson.subject}
      </Text>
      {isEvent ? (
        item.event.note ? <Meta icon="document-text-outline" text={item.event.note} color={color.fg} /> : null
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
          <Meta icon="location-outline" text={`ауд. ${item.lesson.room}`} color={color.fg} />
          <Meta icon="person-outline" text={item.lesson.teacher} color={color.fg} />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text style={{ color: state === 'past' ? c.textMuted : c.text, fontWeight: '800', fontSize: 15 }}>{item.start}</Text>
        <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '500' }}>{item.end}</Text>
      </View>
      <View style={{ flex: 1 }}>{isEvent ? <PressableScale onPress={open.onPress} scaleTo={0.98}>{body}</PressableScale> : body}</View>
    </View>
  );
}

function Meta({ icon, text, color }: { icon: IconName; text: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
      <Icon name={icon} size={14} color={color} />
      <Text style={{ color, fontSize: 14, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  now: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, overflow: 'hidden' },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  week: { flexDirection: 'row', gap: 6 },
  dayPill: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.pill, gap: 2, borderWidth: 1.5 },
  dots: { flexDirection: 'row', gap: 3, height: 6, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  row: { flexDirection: 'row', gap: spacing.md },
  timeCol: { width: 54, paddingTop: spacing.lg, alignItems: 'flex-end' },
  itemCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
});
