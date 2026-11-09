import { useEffect, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ICommand } from '../core/mvvm/Command';
import { radius, spacing, usePalette } from '../theme/theme';
import { IconButton } from './ui';

/**
 * Каркас екранів входу / реєстрації, що вміщається в один екран:
 * верхня панель (назад + анімований прогрес), заголовок, поля, і закріплена знизу дія,
 * яка піднімається разом із клавіатурою. Зміна кроку — м'яке згасання вмісту.
 */
export function AuthScreen({
  back,
  step,
  totalSteps,
  title,
  subtitle,
  children,
  bottom,
}: {
  back: ICommand;
  step?: number;
  totalSteps?: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  bottom: ReactNode;
}) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss} accessible={false}>
        <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton command={back} icon="arrow-back" />
          {step && totalSteps ? (
            <>
              <View style={styles.progress}>
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <Segment key={i} filled={i < step} />
                ))}
              </View>
              <Text style={{ color: c.textMuted, fontWeight: '700', fontSize: 13 }}>
                {step} з {totalSteps}
              </Text>
            </>
          ) : null}
        </View>

        <Animated.View key={step ?? 0} entering={FadeIn.duration(220)} style={styles.body}>
          <View style={{ gap: spacing.sm }}>
            <Text style={[styles.title, { color: c.text }]}>{title}</Text>
            <Text style={{ color: c.textMuted, fontSize: 16, lineHeight: 23 }}>{subtitle}</Text>
          </View>
          <View style={{ gap: spacing.md }}>{children}</View>
        </Animated.View>

        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>{bottom}</View>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function Segment({ filled }: { filled: boolean }) {
  const c = usePalette();
  const progress = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(filled ? 1 : 0, { duration: 350 });
  }, [filled, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View style={[styles.segment, { backgroundColor: c.border }]}>
      <Animated.View style={[styles.segmentFill, { backgroundColor: c.accent }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  segmentFill: { height: '100%', borderRadius: radius.pill },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.xl },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  bottom: { paddingHorizontal: spacing.xl, gap: spacing.xs, paddingTop: spacing.sm },
});
