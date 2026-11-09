import { useEffect, useState } from 'react';
import { Easing, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Services, container } from '../../AppServices';
import { useViewModel } from '../../core/mvvm/hooks';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { Easing as REasing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { IconName } from '../../components/ui';
import { radius, spacing, usePalette } from '../../theme/theme';

const TABS: Record<string, { title: string; icon: IconName; iconActive: IconName }> = {
  index: { title: 'Розклад', icon: 'calendar-clear-outline', iconActive: 'calendar-clear' },
  assignments: { title: 'Завдання', icon: 'checkbox-outline', iconActive: 'checkbox' },
  chat: { title: 'Чат', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  profile: { title: 'Профіль', icon: 'person-outline', iconActive: 'person' },
};

/** Нижні вкладки: Розклад · Завдання · Чат · Профіль у вигляді плаваючої «пігулки». */
export default function TabsLayout() {
  const c = usePalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.background },
        // Перехід між вкладками — плавний фейд.
        animation: 'fade',
        transitionSpec: { animation: 'timing', config: { duration: 220, easing: Easing.out(Easing.quad) } },
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: TABS.index.title }} />
      <Tabs.Screen name="assignments" options={{ title: TABS.assignments.title }} />
      <Tabs.Screen name="chat" options={{ title: TABS.chat.title }} />
      <Tabs.Screen name="profile" options={{ title: TABS.profile.title }} />
    </Tabs>
  );
}

const TAB_H = 48;
const BAR_PAD = 5;

/** Плаваючий таб-бар лише з іконками; активна «пігулка» плавно переїжджає під обрану вкладку. */
function FloatingTabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  const c = usePalette();
  const [barWidth, setBarWidth] = useState(0);
  const position = useSharedValue(state.index);
  useEffect(() => {
    position.set(withTiming(state.index, { duration: 260, easing: REasing.out(REasing.cubic) }));
  }, [position, state.index]);
  const tabWidth = Math.max(0, (barWidth - BAR_PAD * 2) / state.routes.length);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * tabWidth }] }));
  const chat = useViewModel(container.get(Services.Chat)); // бейдж непрочитаних
  const keyboard = useKeyboardVisible();
  if (keyboard) return null; // на час набору тексту таб-бар ховається

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom - 6, spacing.lg) }]}>
      <View onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)} style={[styles.bar, { backgroundColor: c.tabBar, shadowColor: '#000' }]}>
        {barWidth > 0 ? <Animated.View pointerEvents="none" style={[styles.indicator, { width: tabWidth, backgroundColor: c.accentSoft }, indicator]} /> : null}
        {state.routes.map((route, i) => {
          const tab = TABS[route.name];
          if (!tab) return null;
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              onPress={() => navigateToTab(route.key)}
              accessibilityRole="tab"
              accessibilityLabel={tab.title}
              accessibilityState={{ selected: focused }}
              style={styles.tab}
            >
              <Ionicons name={focused ? tab.iconActive : tab.icon} size={25} color={focused ? c.accent : c.tabInactive} />
              {route.name === 'chat' && chat.unread > 0 && !focused ? (
                <View style={[styles.badge, { backgroundColor: c.accent, borderColor: c.tabBar }]}>
                  <Text style={{ color: c.accentText, fontSize: 11, fontWeight: '800' }}>{chat.unread > 9 ? '9+' : chat.unread}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    padding: BAR_PAD,
    borderRadius: radius.pill,
    width: '100%',
    maxWidth: 330,
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  indicator: { position: 'absolute', left: BAR_PAD, top: BAR_PAD, height: TAB_H, borderRadius: radius.pill },
  tab: { flex: 1, height: TAB_H, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', gap: 3 },
  badge: { position: 'absolute', top: 3, right: 12, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
});

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
