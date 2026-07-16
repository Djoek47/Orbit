import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { orbitTabColors } from '@/constants/orbit-theme';

const INACTIVE = '#3A5070';

const TAB_ORDER = ['index', 'tasks', 'plan', 'rewards', 'nova'] as const;
type TabRoute = (typeof TAB_ORDER)[number];

const TAB_META: Record<
  TabRoute,
  { label: string; color: string; icon: 'house.fill' | 'checklist' | 'calendar' | 'trophy.fill' | 'sparkles' }
> = {
  index: { label: 'Home', color: orbitTabColors.home, icon: 'house.fill' },
  tasks: { label: 'Tasks', color: orbitTabColors.tasks, icon: 'checklist' },
  plan: { label: 'Plan', color: orbitTabColors.plan, icon: 'calendar' },
  rewards: { label: 'Ranks', color: orbitTabColors.ranking, icon: 'trophy.fill' },
  nova: { label: 'Nova', color: orbitTabColors.nova, icon: 'sparkles' },
};

/** Make App.tsx TabBar — exact tokens, native port. */
export function MakeTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const activeRouteName = state.routes[state.index]?.name;

  const visibleRoutes = TAB_ORDER.map((name) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return null;
    return { route };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {visibleRoutes.map(({ route }) => {
          const isFocused = activeRouteName === route.name;
          const meta = TAB_META[route.name as TabRoute];
          if (!meta) return null;

          const isNova = route.name === 'nova';
          const { label, color, icon } = meta;

          const onPress = () => {
            if (process.env.EXPO_OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const labelColor = isFocused ? (isNova ? '#38BDF8' : color) : INACTIVE;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.tab, isNova && styles.novaTab]}>
              {isNova ? (
                <LinearGradient
                  colors={isFocused ? ['#38BDF8', '#0EA5E9'] : ['#0F2644', '#0A1E38']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.novaButton,
                    isFocused ? styles.novaButtonActive : styles.novaButtonInactive,
                  ]}>
                  <IconSymbol
                    name={icon}
                    size={20}
                    color={isFocused ? '#070D1C' : '#38BDF8'}
                  />
                </LinearGradient>
              ) : (
                <View style={styles.iconColumn}>
                  <View
                    style={[
                      styles.iconBox,
                      isFocused && { backgroundColor: `${color}1A` },
                    ]}>
                    <IconSymbol name={icon} size={20} color={isFocused ? color : INACTIVE} />
                  </View>
                  {isFocused ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
                </View>
              )}
              <Text
                style={[
                  styles.label,
                  { color: labelColor, fontWeight: isFocused ? '600' : '400' },
                  isNova && styles.novaLabel,
                ]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.homeIndicatorRow}>
        <View style={styles.homeIndicator} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'rgba(7, 13, 28, 0.94)',
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderTopWidth: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    paddingBottom: 4,
  },
  novaTab: {
    paddingBottom: 0,
  },
  iconColumn: {
    alignItems: 'center',
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dot: {
    borderRadius: 2,
    height: 4,
    marginTop: 2,
    width: 4,
  },
  novaButton: {
    alignItems: 'center',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    marginTop: -20,
    width: 48,
  },
  novaButtonActive: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  novaButtonInactive: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  label: {
    fontSize: 10,
  },
  novaLabel: {
    marginTop: 2,
  },
  homeIndicatorRow: {
    alignItems: 'center',
    paddingBottom: 8,
    paddingTop: 4,
  },
  homeIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 999,
    height: 5,
    width: 130,
  },
});
