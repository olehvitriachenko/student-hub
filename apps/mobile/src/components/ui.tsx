import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommand } from '../core/mvvm/hooks';
import type { ICommand } from '../core/mvvm/Command';
import { radius, spacing, TAB_BAR_SPACE, usePalette } from '../theme/theme';
import { haptic } from '../utils/haptics';

/** Спільні "дурні" компоненти View-шару: без бізнес-логіки, лише відображення та анімації. */

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const c = usePalette();
  return <Ionicons name={name} size={size} color={color ?? c.text} />;
}

// ---------------------------------------------------------------- motion

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS = { duration: 110 };

/** Pressable, що плавно «втискається» при натисканні (без пружини). */
export function PressableScale({ style, children, scaleTo = 0.97, disabled, ...props }: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; children?: ReactNode }) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withTiming(scaleTo, PRESS));
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, PRESS));
        props.onPressOut?.(e);
      }}
      style={[style, anim]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** М'яка поява (fade) для карток у списках, без стрибків. */
export function FadeInItem({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeIn.duration(220).delay(Math.min(index, 6) * 30)} style={style}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------- layout

export function Card({
  children,
  style,
  onPress,
  tone = 'default',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: 'default' | 'ink';
}) {
  const c = usePalette();
  const base = [styles.card, { backgroundColor: tone === 'ink' ? c.ink : c.surface, borderColor: c.border, borderWidth: 1, shadowColor: c.shadow }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={base}>
      {children}
    </PressableScale>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const c = usePalette();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.section, { color: c.text }]}>{children}</Text>
      {right}
    </View>
  );
}

/** Великий заголовок вкладки з урахуванням safe area. */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={{ flex: 1, gap: 2 }}>
        {subtitle ? <Text style={{ color: c.textMuted, fontSize: 15, fontWeight: '500' }}>{subtitle}</Text> : null}
        <Text style={[styles.headerTitle, { color: c.text }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------- inputs

export function Field({
  label,
  icon,
  secure,
  ...props
}: TextInputProps & { label?: string; icon?: IconName; secure?: boolean }) {
  const c = usePalette();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={{ gap: 8 }}>
      {label ? <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: c.surface, borderColor: focused ? c.text : c.border },
          props.multiline && { alignItems: 'flex-start', paddingVertical: spacing.sm },
        ]}
      >
        {icon ? <Ionicons name={icon} size={19} color={focused ? c.text : c.textMuted} /> : null}
        <TextInput
          placeholderTextColor={c.textMuted}
          selectionColor={c.accent}
          secureTextEntry={secure && hidden}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[styles.input, { color: c.text }, props.multiline && { minHeight: 84, textAlignVertical: 'top' }, props.style]}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel="Показати пароль">
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={19} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- buttons

type Variant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';

/** Кнопка-пігулка, прив'язана до ICommand: блокується за CanExecute, показує спінер під час виконання. */
export function CommandButton<P>({
  command,
  param,
  title,
  icon,
  variant = 'primary',
  compact,
  style,
}: {
  command: ICommand<P>;
  param?: P;
  title: string;
  icon?: IconName;
  variant?: Variant;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { disabled, onPress } = useCommand(command, param as P);
  const c = usePalette();
  const running = !!command.isRunning;
  const off = disabled && !running; // вимкнена кнопка — суцільні приглушені кольори, а не прозорість
  const bg = off && variant !== 'ghost' ? c.surfaceAlt : { primary: c.primary, accent: c.accent, secondary: c.surface, danger: c.dangerBg, ghost: 'transparent' }[variant];
  const fg = off ? c.textMuted : { primary: c.primaryText, accent: c.accentText, secondary: c.text, danger: c.danger, ghost: c.text }[variant];
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={[
        styles.button,
        compact && styles.buttonCompact,
        variant === 'secondary' && { borderWidth: 1, borderColor: c.border },
        { backgroundColor: bg },
        style,
      ]}
    >
      {running ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={compact ? 16 : 19} color={fg} /> : null}
          <Text style={{ color: fg, fontWeight: '700', fontSize: compact ? 14 : 16, letterSpacing: -0.2 }}>{title}</Text>
        </>
      )}
    </PressableScale>
  );
}

/** Кругла кнопка-іконка. */
export function IconButton<P>({ command, param, icon, tone = 'surface' }: { command: ICommand<P>; param?: P; icon: IconName; tone?: 'surface' | 'ink' | 'accent' }) {
  const { disabled, onPress } = useCommand(command, param as P);
  const c = usePalette();
  const bg = { surface: c.surface, ink: c.primary, accent: c.accent }[tone];
  const fg = { surface: c.text, ink: c.primaryText, accent: c.accentText }[tone];
  return (
    <PressableScale onPress={onPress} disabled={disabled} hitSlop={8} style={[styles.iconButton, { backgroundColor: bg }]}>
      {command.isRunning ? <ActivityIndicator color={fg} /> : <Ionicons name={icon} size={20} color={disabled ? c.textMuted : fg} />}
    </PressableScale>
  );
}

// ---------------------------------------------------------------- pills

type Tone = 'success' | 'muted' | 'warning' | 'danger' | 'accent' | 'ink';

/** Маленька «таблетка» зі статусом. */
export function Badge({ text, tone, icon }: { text: string; tone: Tone; icon?: IconName }) {
  const c = usePalette();
  const map = {
    success: [c.successBg, c.success],
    muted: [c.surfaceAlt, c.textMuted],
    warning: [c.warningBg, c.warning],
    danger: [c.dangerBg, c.danger],
    accent: [c.accentSoft, c.accent],
    ink: [c.primary, c.primaryText],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

/** Пастельна «таблетка» довільного кольору (предмет, категорія). */
export function Tag({ text, bg, fg, icon }: { text: string; bg: string; fg: string; icon?: IconName }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** Чіп-перемикач (фільтр, вибір предмета, днів тощо). */
export function Chip<P>({
  command,
  param,
  label,
  selected,
  icon,
}: {
  command: ICommand<P>;
  param: P;
  label: string;
  selected: boolean;
  icon?: IconName;
}) {
  const { onPress } = useCommand(command, param);
  const c = usePalette();
  return (
    <PressableScale
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={[styles.chip, { backgroundColor: selected ? c.accentSoft : c.surface, borderColor: selected ? c.accent : c.border }]}
    >
      {icon ? <Ionicons name={icon} size={15} color={selected ? c.accent : c.text} /> : null}
      <Text style={{ color: selected ? c.accent : c.text, fontWeight: '600', fontSize: 14 }}>{label}</Text>
    </PressableScale>
  );
}

// ---------------------------------------------------------------- rows

export function Row({ label, value, icon }: { label: string; value: ReactNode; icon?: IconName }) {
  const c = usePalette();
  return (
    <View style={styles.row}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {icon ? <Ionicons name={icon} size={18} color={c.textMuted} /> : null}
        <Text style={{ color: c.textMuted, fontSize: 15 }}>{label}</Text>
      </View>
      {typeof value === 'string' ? (
        <Text style={{ color: c.text, fontWeight: '600', fontSize: 15, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
      ) : (
        value
      )}
    </View>
  );
}

/** Пункт меню зі стрілкою (профіль). */
export function MenuItem<P>({
  command,
  icon,
  title,
  danger,
  last,
  right,
}: {
  command: ICommand<P>;
  icon: IconName;
  title: string;
  danger?: boolean;
  last?: boolean;
  right?: ReactNode;
}) {
  const { onPress, disabled } = useCommand(command, undefined as P);
  const c = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.menuItem,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
        pressed && { opacity: 0.55 },
      ]}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? c.dangerBg : c.surfaceAlt }]}>
        <Ionicons name={icon} size={18} color={danger ? c.danger : c.text} />
      </View>
      <Text style={{ flex: 1, color: danger ? c.danger : c.text, fontSize: 16, fontWeight: '500' }}>{title}</Text>
      {right ?? (!danger && <Ionicons name="chevron-forward" size={18} color={c.textMuted} />)}
    </Pressable>
  );
}

/** Рядок з перемикачем (налаштування сповіщень). */
export function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
  last,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  const c = usePalette();
  return (
    <View style={[styles.menuItem, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <View style={[styles.menuIcon, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name={icon} size={18} color={c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 16, fontWeight: '500' }}>{title}</Text>
        {subtitle ? <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent, false: c.surfaceAlt }} ios_backgroundColor={c.surfaceAlt} />
    </View>
  );
}

// ---------------------------------------------------------------- feedback

export function Banner({ text, tone = 'danger' }: { text: string; tone?: 'danger' | 'warning' }) {
  const c = usePalette();
  const [bg, fg] = tone === 'danger' ? [c.dangerBg, c.danger] : [c.warningBg, c.warning];
  return (
    <Animated.View entering={FadeIn.duration(200)} style={[styles.banner, { backgroundColor: bg }]}>
      <Ionicons name={tone === 'danger' ? 'alert-circle' : 'cloud-offline-outline'} size={18} color={fg} />
      <Text style={{ color: fg, flex: 1, fontSize: 14, fontWeight: '600' }}>{text}</Text>
    </Animated.View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: IconName; title: string; subtitle?: string }) {
  const c = usePalette();
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name={icon} size={30} color={c.accent} />
      </View>
      <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
      {subtitle ? <Text style={{ color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>{subtitle}</Text> : null}
    </Animated.View>
  );
}

export function Avatar({ text, size = 72 }: { text: string; size?: number }) {
  const c = usePalette();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.accentText, fontSize: size * 0.36, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

/** Плашка знизу над таб-баром із дією (наприклад, «Скасувати» після видалення). */
export function Snackbar<P>({ text, actionLabel, command, param }: { text: string; actionLabel: string; command: ICommand<P>; param?: P }) {
  const c = usePalette();
  const { onPress } = useCommand(command, param as P);
  return (
    <Animated.View entering={FadeIn.duration(180)} style={[styles.snack, { backgroundColor: c.ink, bottom: TAB_BAR_SPACE - 4 }]}>
      <Text style={{ color: c.inkText, fontSize: 15, fontWeight: '600', flex: 1 }} numberOfLines={1}>
        {text}
      </Text>
      <Pressable
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        hitSlop={10}
      >
        <Text style={{ color: c.accent, fontSize: 15, fontWeight: '800' }}>{actionLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  snack: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 16,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 1,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  section: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  headerTitle: { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  label: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: spacing.lg },
  input: { flex: 1, fontSize: 16, paddingVertical: 15 },
  button: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderRadius: radius.pill,
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: spacing.lg },
  iconButton: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, alignSelf: 'flex-start' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14 },
  menuIcon: { width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
});
