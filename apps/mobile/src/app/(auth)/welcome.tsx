import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Services } from '../../AppServices';
import { usePageViewModel } from '../../core/mvvm/usePageViewModel';
import { CommandButton, type IconName } from '../../components/ui';
import { radius, spacing, usePalette } from '../../theme/theme';

/** WelcomePage (View): головний екран для гостя — що вміє застосунок + дві дії. */
export default function WelcomePage() {
  const vm = usePageViewModel(Services.WelcomeViewModel);
  const c = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top + spacing.sm }}>
      <Animated.View entering={FadeIn.duration(300)} style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: c.primary }]}>
          <Ionicons name="school" size={20} color={c.primaryText} />
        </View>
        <Text style={[styles.brandText, { color: c.text }]}>Student Hub</Text>
      </Animated.View>

      {/* Ілюстрація: картки кабінету */}
      <View style={styles.stage}>
        <Floating delay={0} rotate="-4deg" style={{ alignSelf: 'flex-start' }}>
          <PreviewCard bg="#E6E1FF" fg="#4B3FC7" icon="time" title="Бази даних" meta="10:05 · ауд. 314" pill="зараз" />
        </Floating>
        <Floating delay={400} rotate="3deg" style={{ alignSelf: 'flex-end' }}>
          <PreviewCard bg="#D6F1E2" fg="#1E7A4E" icon="checkmark-done" title="Лабораторна №3" meta="здати завтра" />
        </Floating>
        <Floating delay={800} rotate="-2deg" style={{ alignSelf: 'flex-start', marginLeft: 24 }}>
          <PreviewCard bg="#FFE1D3" fg="#C24E1E" icon="notifications" title="Нагадування" meta="пара через 10 хв" />
        </Floating>
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Animated.View entering={FadeIn.duration(300).delay(100)} style={{ gap: spacing.sm }}>
          <Text style={[styles.title, { color: c.text }]}>
            Навчання <Text style={{ color: c.accent }}>під контролем</Text>
          </Text>
          <Text style={{ color: c.textMuted, fontSize: 16, lineHeight: 23 }}>
            Розклад групи, дедлайни, події та нагадування — в одному застосунку.
          </Text>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(300).delay(150)} style={{ gap: spacing.sm }}>
          <CommandButton command={vm.openRegisterCommand} title="Почати" icon="arrow-forward" />
          <CommandButton command={vm.openLoginCommand} title="У мене вже є акаунт" variant="ghost" />
        </Animated.View>
      </View>
    </View>
  );
}

/** Картка-ілюстрація з легким нахилом. */
function Floating({ delay, rotate, style, children }: { delay: number; rotate: string; style?: ViewStyle; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeIn.duration(300).delay(delay / 4)} style={[style, { transform: [{ rotate }] }]}>
      {children}
    </Animated.View>
  );
}

function PreviewCard({ bg, fg, icon, title, meta, pill }: { bg: string; fg: string; icon: IconName; title: string; meta: string; pill?: string }) {
  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <View style={[styles.cardIcon, { backgroundColor: fg }]}>
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <View>
        <Text style={[styles.cardTitle, { color: '#16151C' }]}>{title}</Text>
        <Text style={{ color: fg, fontSize: 13, fontWeight: '600', marginTop: 1 }}>{meta}</Text>
      </View>
      {pill ? (
        <View style={[styles.cardPill, { backgroundColor: '#16151C' }]}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{pill}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  logo: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  stage: { flex: 1, justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.lg,
  },
  cardIcon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontWeight: '800', fontSize: 16, letterSpacing: -0.3 },
  cardPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, marginLeft: spacing.xs },
  bottom: { gap: spacing.xl, paddingHorizontal: spacing.xl },
  title: { fontSize: 38, fontWeight: '800', letterSpacing: -1.4, lineHeight: 42 },
});
