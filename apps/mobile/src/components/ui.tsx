import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useCommand } from '../core/mvvm/hooks';
import type { ICommand } from '../core/mvvm/Command';
import { radius, spacing, usePalette } from '../theme/theme';

/** Спільні "дурні" компоненти View-шару: без логіки, лише відображення. */

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = usePalette();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const c = usePalette();
  return <Text style={[styles.section, { color: c.textMuted }]}>{children}</Text>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = usePalette();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{label}</Text>
      <TextInput
        placeholderTextColor={c.textMuted}
        {...props}
        style={[styles.input, { color: c.text, backgroundColor: c.surfaceAlt, borderColor: c.border }, props.style]}
      />
    </View>
  );
}

type Variant = 'primary' | 'secondary' | 'danger';

/** Кнопка, прив'язана до ICommand: сама блокується за CanExecute (лаб. 1, ч. 2). */
export function CommandButton<P>({
  command,
  param,
  title,
  variant = 'primary',
  compact,
}: {
  command: ICommand<P>;
  param?: P;
  title: string;
  variant?: Variant;
  compact?: boolean;
}) {
  const { disabled, onPress } = useCommand(command, param as P);
  const c = usePalette();
  const bg = variant === 'primary' ? c.primary : variant === 'danger' ? c.dangerBg : c.surfaceAlt;
  const fg = variant === 'primary' ? c.primaryText : variant === 'danger' ? c.danger : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={{ color: fg, fontWeight: '600', fontSize: compact ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Badge({ text, tone }: { text: string; tone: 'success' | 'muted' | 'warning' | 'danger' }) {
  const c = usePalette();
  const map = {
    success: [c.successBg, c.success],
    muted: [c.surfaceAlt, c.textMuted],
    warning: [c.surfaceAlt, c.warning],
    danger: [c.dangerBg, c.danger],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  const c = usePalette();
  return (
    <View style={styles.row}>
      <Text style={{ color: c.textMuted }}>{label}</Text>
      {typeof value === 'string' ? <Text style={{ color: c.text, fontWeight: '500', flexShrink: 1, textAlign: 'right' }}>{value}</Text> : value}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.md },
  section: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.sm },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 16 },
  button: { borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  buttonCompact: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
});
