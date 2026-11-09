import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { haptic } from '../../utils/haptics';
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
        <ScreenHeader subtitle={vm.greetingText} title="Розклад" right={vm.group ? (
          <View style={[styles.group, { backgroundColor: c.surface }]}>
            <Icon name="people-outline" size={15} color={c.accent} />
            <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>{vm.group}</Text>
          </View>
        ) : null} />

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
          {vm.error ? <Banner text={vm.error} tone={vm.hasData ? 'warning' : 'danger'} /> : null}

          <View style={[styles.calendar, { backgroundColor: c.surface, borderColor: c.border }]}>
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

          </View>

          <SectionTitle>{vm.selectedTitle}</SectionTitle>
          <Text style={{ color: c.textMuted, fontSize: 13, marginTop: -spacing.sm }}>
            {vm.items.length ? `Подій на день: ${vm.items.length}` : 'На цей день поки нічого не заплановано'}
          </Text>

          <DaySwipe vm={vm}>
          {vm.items.length === 0 ? (
            <EmptyState icon="sunny-outline" title="Вільний день" subtitle="На цей день занять немає." />
          ) : (
            <View style={{ gap: spacing.md }} key={vm.selectedDate}>
              {vm.items.map((item, i) => (
                <FadeInItem key={item.key} index={i}>
                  <TimelineRow vm={vm} item={item} state={vm.itemState(item)} isNext={item.key === vm.nextLessonKey} />
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

function DayPill({ vm, day, selected }: { vm: ScheduleViewModel; day: WeekDay; selected: boolean }) {
  const { onPress } = useCommand(vm.selectDateCommand, day.date);
  const c = usePalette();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${day.label}, ${day.dayOfMonth}`}
      accessibilityState={{ selected }}
      style={styles.dayPill}
    >
      <Text style={{ color: selected ? c.accent : c.textMuted, fontSize: 12, fontWeight: '700' }}>{day.label}</Text>
      <View style={[styles.dayNumber, { backgroundColor: selected ? c.accent : 'transparent', borderColor: day.isToday && !selected ? c.accent : 'transparent' }]}>
        <Text style={{ color: selected ? '#24130D' : c.text, fontSize: 17, fontWeight: '700' }}>{day.dayOfMonth}</Text>
      </View>
      <View style={styles.dots}>
        {day.count > 0 ? <View style={[styles.dot, { backgroundColor: selected ? c.accent : c.textMuted }]} /> : null}
      </View>
    </PressableScale>
  );
}

function TimelineRow({ vm, item, state, isNext }: { vm: ScheduleViewModel; item: TimelineItem; state: ItemState; isNext: boolean }) {
  const c = usePalette();
  const pastel = usePastel();
  const isEvent = item.kind === 'event';
  const base = pastel(isEvent ? item.event.category : item.lesson.subject);
  const color = base;
  const open = useCommand(vm.openEventCommand, isEvent ? item.event : (null as never));

  const body = (
    <View style={[styles.itemCard, { backgroundColor: c.surface, borderColor: state === 'now' ? c.accent : c.border, borderWidth: state === 'now' ? 2 : 1, shadowColor: c.shadow }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {isEvent ? (
          <Tag text={categoryOf(item.event.category).label} bg={color.bg} fg={color.fg} icon={categoryOf(item.event.category).icon as IconName} />
        ) : (
          <Tag text={item.lesson.type} bg={color.bg} fg={color.fg} icon={item.lesson.type === 'Лекція' ? 'mic-outline' : 'flask-outline'} />
        )}
        {state === 'now' ? <Badge text="Зараз триває" tone="accent" icon="radio-button-on" /> : isNext ? <Badge text="Наступна" tone="muted" icon="time-outline" /> : null}
        {isEvent && item.event.remind && state !== 'now' ? <Icon name="notifications" size={16} color={c.textMuted} /> : null}
      </View>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 }} numberOfLines={2}>
        {isEvent ? item.event.title : item.lesson.subject}
      </Text>
      {isEvent ? (
        item.event.note ? <Meta icon="document-text-outline" text={item.event.note} color={c.textMuted} /> : null
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
          <Meta icon="location-outline" text={`ауд. ${item.lesson.room}`} color={c.textMuted} />
          <Meta icon="person-outline" text={item.lesson.teacher} color={c.textMuted} />
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.row}>
      <View style={styles.timeRow}>
        <Icon name="time-outline" size={15} color={c.textMuted} />
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>
          {item.start} – {item.end}
        </Text>
        <View style={[styles.timeLine, { backgroundColor: c.border }]} />
      </View>
      {isEvent ? <PressableScale onPress={open.onPress} scaleTo={0.98}>{body}</PressableScale> : body}
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
  group: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  calendar: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm, borderWidth: 1 },
  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  week: { flexDirection: 'row', gap: 6 },
  dayPill: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.xs },
  dayNumber: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dots: { flexDirection: 'row', gap: 3, height: 6, alignItems: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  row: { gap: spacing.sm },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.xs },
  timeLine: { flex: 1, height: StyleSheet.hairlineWidth, marginLeft: spacing.sm },
  itemCard: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2 },
});
