import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { androidBlurMethod, material, resolveBlurTint } from '@/constants/material-tokens';
import { orbitTabColors, radius, shadow, space } from '@/constants/orbit-theme';
import { useOrbitOptional } from '@/store/orbit-store';

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

/**
 * Floating Liquid Glass tab bar — see docs/design-system/08-liquid-glass-guidelines.md
 * "Concrete before/after": inset rounded-rect glass, not a full-bleed opaque bar.
 * Reuses global-header-chips.tsx's proven BlurView + gradient-wash recipe.
 */
export function MakeTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const orbit = useOrbitOptional();
  const accentPrimary = orbit?.accentTheme.primary ?? '#38BDF8';
  const accentSecondary = orbit?.accentTheme.secondary ?? '#0EA5E9';
  const typeStyle = orbit?.accentTheme.typeStyle;
  const isDark = orbit?.orbitPalette.isDark ?? true;
  const activeRouteName = state.routes[state.index]?.name;

  const visibleRoutes = TAB_ORDER.map((name) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return null;
    return { route };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom - 4, space.xs) }]}>
      <View style={[styles.bar, isDark ? shadow.floating.dark : shadow.floating.light]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BlurView
            intensity={Platform.OS === 'ios' ? material.liquidGlass.intensity : material.liquidGlass.androidIntensity}
            tint={resolveBlurTint(isDark)}
            experimentalBlurMethod={androidBlurMethod}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              `${accentPrimary}${isDark ? '26' : '30'}`,
              `${accentSecondary}${isDark ? '14' : '1A'}`,
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
        {visibleRoutes.map(({ route }) => {
          const isFocused = activeRouteName === route.name;
          const meta = TAB_META[route.name as TabRoute];
          if (!meta) return null;

          const isNova = route.name === 'nova';
          const { label, icon } = meta;
          const color = isFocused ? accentPrimary : meta.color;

          const onPress = () => {
            if (process.env.EXPO_OS === 'ios') {
              Haptics.selectionAsync();
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

          const labelColor = isFocused ? (isNova ? accentPrimary : color) : INACTIVE;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.tab, isNova && styles.novaTab]}>
              {isNova ? (
                <LinearGradient
                  colors={isFocused ? [accentPrimary, accentSecondary] : ['#0F2644', '#0A1E38']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.novaButton,
                    isFocused ? styles.novaButtonActive : styles.novaButtonInactive,
                    {
                      borderColor: `${accentPrimary}66`,
                      shadowColor: accentPrimary,
                    },
                  ]}>
                  <IconSymbol name={icon} size={20} color={isFocused ? '#070D1C' : accentPrimary} />
                </LinearGradient>
              ) : (
                <View style={styles.iconColumn}>
                  <View style={[styles.iconBox, isFocused && { backgroundColor: `${color}1A` }]}>
                    <IconSymbol name={icon} size={20} color={isFocused ? color : INACTIVE} />
                  </View>
                  {isFocused ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
                </View>
              )}
              <Text
                style={[
                  styles.label,
                  {
                    color: labelColor,
                    fontWeight: isFocused
                      ? (typeStyle?.captionWeight ?? '600')
                      : '400',
                    letterSpacing: isFocused ? (typeStyle?.letterSpacing ?? 0) : 0,
                  },
                  isNova && styles.novaLabel,
                ]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
    paddingHorizontal: space.sm,
  },
  bar: {
    alignItems: 'flex-end',
    borderRadius: radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    overflow: 'hidden',
    paddingBottom: 6,
    paddingHorizontal: 8,
    paddingTop: 10,
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
    elevation: 8,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  novaButtonInactive: {
    elevation: 4,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  label: {
    fontSize: 10,
  },
  novaLabel: {
    marginTop: 2,
  },
});
