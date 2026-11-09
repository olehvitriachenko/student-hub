import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Services } from '../../AppServices';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { CommandButton, type IconName } from '../../components/ui';
import { radius, spacing, usePalette } from '../../theme/theme';

/** Вітальний екран із коротким оглядом можливостей та діями для входу. */
export default function WelcomePage() {
  const vm = usePageViewModel(Services.WelcomeViewModel);
  const c = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
    >
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.background}>
        <View style={[styles.orb, styles.orbTop, { backgroundColor: c.accentSoft }]} />
        <View style={[styles.orb, styles.orbSide, { backgroundColor: c.successBg }]} />
        <View style={[styles.ring, { borderColor: c.accent }]} />
        <Ionicons name="sparkles" size={22} color={c.accent} style={styles.sparkle} />
      </View>
      <Animated.View entering={FadeIn.duration(300)} style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: c.primary }]}>
          <Ionicons name="school" size={20} color={c.primaryText} />
        </View>
        <Text style={[styles.brandText, { color: c.text }]}>Student Hub</Text>
      </Animated.View>

      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(350)} style={styles.intro}>
          <View style={[styles.eyebrow, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="sparkles" size={14} color={c.accent} />
            <Text style={{ color: c.accent, fontSize: 12, fontWeight: '700' }}>ТВІЙ НАВЧАЛЬНИЙ ПРОСТІР</Text>
          </View>
          <Text style={[styles.title, { color: c.text }]}>
            Більше ясності <Text style={{ color: c.accent }}>щодня.</Text>
          </Text>
          <Text style={[styles.description, { color: c.textMuted }]}>
            Розклад, завдання та нагадування — усе потрібне для навчання під рукою.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(350).delay(100)} style={[styles.preview, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.previewHeader}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '600' }}>Твій день</Text>
              <Text style={{ color: c.text, fontSize: 19, fontWeight: '800' }}>Усе за планом</Text>
            </View>
            <View style={[styles.calendarIcon, { backgroundColor: c.accentSoft }]}>
              <Ionicons name="calendar-outline" size={21} color={c.accent} />
            </View>
          </View>
          <PreviewRow icon="time-outline" title="Розклад занять" subtitle="Пари та події в одному місці" />
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />
          <PreviewRow icon="checkmark-circle-outline" title="Завдання і дедлайни" subtitle="Знай, що важливо зробити" />
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />
          <PreviewRow icon="notifications-outline" title="Корисні нагадування" subtitle="Не пропусти важливе" />
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.duration(350).delay(150)} style={styles.actions}>
        <CommandButton command={vm.openRegisterCommand} title="Створити акаунт" icon="arrow-forward" />
        <CommandButton command={vm.openLoginCommand} title="У мене вже є акаунт" variant="ghost" />
      </Animated.View>
    </ScrollView>
  );
}

function PreviewRow({ icon, title, subtitle }: { icon: IconName; title: string; subtitle: string }) {
  const c = usePalette();
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name={icon} size={20} color={c.text} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: c.textMuted, fontSize: 13, lineHeight: 18 }}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: spacing.xl, gap: spacing.xl, overflow: 'hidden' },
  background: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: radius.pill, opacity: 0.7 },
  orbTop: { width: 260, height: 260, top: -120, right: -100 },
  orbSide: { width: 220, height: 220, top: '42%', left: -155 },
  ring: { position: 'absolute', width: 82, height: 82, borderWidth: 1.5, borderRadius: 41, opacity: 0.2, top: '28%', right: -25 },
  sparkle: { position: 'absolute', opacity: 0.3, top: '20%', right: 32 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.xl, paddingVertical: spacing.lg },
  intro: { gap: spacing.md },
  eyebrow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  title: { fontSize: 38, fontWeight: '800', letterSpacing: -1.3, lineHeight: 43 },
  description: { fontSize: 16, lineHeight: 24 },
  preview: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  previewHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing.xs },
  calendarIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: spacing.xs },
});
