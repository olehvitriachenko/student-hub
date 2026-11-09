import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Services } from '../../AppServices';
import { useCommand } from '../../core/mvvm/hooks';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { Icon, PressableScale } from '../../components/ui';
import type { ICommand } from '../../core/mvvm/Command';
import { radius, spacing, usePalette } from '../../theme/theme';
import { haptic } from '../../utils/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 280;
const STROKE = 16;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const DURATIONS = [15, 25, 50];

/** FocusPage (View): Pomodoro-таймер для завдання з анімованим кільцем прогресу. */
export default function FocusPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vm = usePageViewModel(Services.FocusViewModel);
  const c = usePalette();
  const insets = useSafeAreaInsets();
  const isBreak = vm.mode === 'break';
  const ringColor = isBreak ? c.success : c.accent;

  useEffect(() => {
    void vm.initialize(String(id));
  }, [vm, id]);

  // Відгук на завершення сесії.
  const finished = useRef(false);
  useEffect(() => {
    if (vm.justFinished && !finished.current) haptic.success();
    finished.current = vm.justFinished;
  }, [vm.justFinished]);

  return (
    <View style={[styles.screen, { backgroundColor: c.ink, paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }]}>
      <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
      <StatusBar style="light" />

      <View style={styles.top}>
        <RoundButton command={vm.closeCommand} icon="close" />
        <View style={[styles.modePill, { backgroundColor: isBreak ? c.success : c.accent }]}>
          <Icon name={isBreak ? 'cafe' : 'flame'} size={14} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{isBreak ? 'Перерва' : 'Фокус'}</Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <View style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xl }}>
        <Text style={{ color: c.inkMuted, fontSize: 14, fontWeight: '600' }}>{vm.assignment?.subject ?? ''}</Text>
        <Text style={{ color: c.inkText, fontSize: 22, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 }} numberOfLines={2}>
          {vm.assignment?.title ?? 'Фокус-сесія'}
        </Text>
      </View>

      <View style={styles.ringWrap}>
        <Ring progress={vm.progress} color={ringColor} track="#2E2C36" />
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.ringCenter}>
            <Text style={[styles.time, { color: c.inkText }]}>{vm.timeText}</Text>
            <Text style={{ color: c.inkMuted, fontSize: 15, fontWeight: '600' }}>
              {vm.running ? (isBreak ? 'відпочиньте' : 'не відволікайтесь') : vm.justFinished ? 'сесію завершено 🎉' : 'на паузі'}
            </Text>
          </View>
        </View>
      </View>

      {/* Тривалість (лише в режимі фокусу й не під час відліку) */}
      <View style={styles.durations}>
        {DURATIONS.map((m) => (
          <DurationChip key={m} command={vm.setDurationCommand} minutes={m} selected={vm.focusMin === m && !isBreak} />
        ))}
      </View>

      <View style={styles.controls}>
        <RoundButton command={vm.resetCommand} icon="refresh" />
        <PlayButton command={vm.toggleCommand} running={vm.running} color={ringColor} />
        <RoundButton command={vm.skipCommand} icon="play-skip-forward" />
      </View>

      <View style={styles.stats}>
        <Stat value={String(vm.sessions)} label="сесій зараз" />
        <View style={{ width: 1, backgroundColor: '#2E2C36' }} />
        <Stat value={`${vm.focusedMinutes} хв`} label="на це завдання" />
      </View>
    </View>
  );
}

/** Кільце прогресу: strokeDashoffset анімується на UI-потоці (reanimated + react-native-svg). */
function Ring({ progress, color, track }: { progress: number; color: string; track: string }) {
  const p = useSharedValue(progress);
  useEffect(() => {
    p.value = withTiming(progress, { duration: 300, easing: Easing.linear });
  }, [progress, p]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - p.value) }));
  return (
    <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={track} strokeWidth={STROKE} fill="none" />
      <AnimatedCircle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={R}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${CIRC} ${CIRC}`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

function PlayButton({ command, running, color }: { command: ICommand; running: boolean; color: string }) {
  const { onPress } = useCommand(command, undefined);
  return (
    <PressableScale
      onPress={() => {
        haptic.heavy();
        onPress();
      }}
      scaleTo={0.92}
      style={[styles.play, { backgroundColor: color }]}
    >
      <Icon name={running ? 'pause' : 'play'} size={36} color="#fff" />
    </PressableScale>
  );
}

function RoundButton({ command, icon }: { command: ICommand; icon: 'close' | 'refresh' | 'play-skip-forward' }) {
  const { onPress, disabled } = useCommand(command, undefined);
  const c = usePalette();
  return (
    <PressableScale
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={disabled}
      style={[styles.round, { backgroundColor: '#2E2C36' }]}
    >
      <Icon name={icon} size={22} color={disabled ? '#5E5B68' : c.inkText} />
    </PressableScale>
  );
}

function DurationChip({ command, minutes, selected }: { command: ICommand<number>; minutes: number; selected: boolean }) {
  const { onPress, disabled } = useCommand(command, minutes);
  return (
    <PressableScale
      onPress={() => {
        haptic.select();
        onPress();
      }}
      disabled={disabled}
      style={[styles.chip, { backgroundColor: selected ? '#FFFFFF' : '#2E2C36' }]}
    >
      <Text style={{ color: selected ? '#16151C' : disabled ? '#5E5B68' : '#F4F2EE', fontWeight: '700', fontSize: 15 }}>{minutes} хв</Text>
    </PressableScale>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const c = usePalette();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.inkText, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: c.inkMuted, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  modePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  ringWrap: { alignSelf: 'center', width: SIZE, height: SIZE },
  ringCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  time: { fontSize: 64, fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  durations: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  play: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  round: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', marginHorizontal: spacing.xl, paddingVertical: spacing.lg, borderRadius: radius.lg, backgroundColor: '#211F28' },
});
