import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { radius, space, typography } from '@/constants/orbit-theme';
import { FontFamily } from '@/constants/typography';
import { useOrbit } from '@/store/orbit-store';
import { Moji } from '@/components/orbit/moji/moji';
import { AppText as Text } from '@/components/orbit/app-text';

export type RouteStepItem = {
  id: string;
  emoji: string;
  title: string;
  address?: string;
  category?: string;
  driveMinutes?: number;
  estimatedMinutes?: number;
  active?: boolean;
};

type RouteStepsProps = {
  steps: RouteStepItem[];
  accentColor?: string;
  /** Highlight the whole route (expanded trip). */
  emphasized?: boolean;
};

/**
 * Vertical glass step timeline — Design 8 ItineraryScreen RouteVisualization.
 */
export function RouteSteps({ steps, accentColor, emphasized = true }: RouteStepsProps) {
  const { orbitPalette, accentTheme } = useOrbit();
  const accent = accentColor ?? accentTheme.primary;

  return (
    <View style={styles.wrap}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isFirst = index === 0;
        const tileBg = emphasized
          ? `${accent}${isFirst ? '40' : '28'}`
          : orbitPalette.isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.04)';
        const tileBorder = emphasized ? `${accent}${isFirst ? '88' : '50'}` : orbitPalette.border;

        return (
          <Animated.View
            key={step.id}
            entering={FadeInDown.delay(index * 55)
              .springify()
              .damping(17)
              .stiffness(160)}
            style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.tile,
                  {
                    backgroundColor: tileBg,
                    borderColor: tileBorder,
                    shadowColor: accent,
                    shadowOpacity: emphasized && isFirst ? 0.35 : 0,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 0 },
                  },
                ]}>
                <Moji emoji={step.emoji} size={20} />
              </View>
              {!isLast ? (
                <View style={styles.connector}>
                  <View
                    style={[
                      styles.railLine,
                      { backgroundColor: emphasized ? `${accent}55` : orbitPalette.border },
                    ]}
                  />
                  {typeof step.driveMinutes === 'number' ? (
                    <View
                      style={[
                        styles.drivePill,
                        {
                          backgroundColor: orbitPalette.isDark
                            ? 'rgba(7,13,28,0.85)'
                            : 'rgba(255,255,255,0.92)',
                          borderColor: emphasized ? `${accent}44` : orbitPalette.border,
                        },
                      ]}>
                      <Text style={[styles.driveText, { color: accent }]}>{step.driveMinutes}m</Text>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.railLine,
                      { backgroundColor: emphasized ? `${accent}55` : orbitPalette.border },
                    ]}
                  />
                </View>
              ) : null}
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.title, { color: orbitPalette.text }]}>{step.title}</Text>
                  {step.address ? (
                    <View style={styles.metaRow}>
                      <MaterialIcons name="place" size={12} color={orbitPalette.textSubtle} />
                      <Text style={[styles.meta, { color: orbitPalette.textSubtle }]} numberOfLines={1}>
                        {step.address}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.badges}>
                  {step.category ? (
                    <View
                      style={[
                        styles.catPill,
                        {
                          backgroundColor: `${accent}1A`,
                          borderColor: `${accent}40`,
                        },
                      ]}>
                      <Text style={[styles.catText, { color: accent }]}>{step.category}</Text>
                    </View>
                  ) : null}
                  {typeof step.estimatedMinutes === 'number' ? (
                    <View style={styles.etaRow}>
                      <MaterialIcons name="schedule" size={11} color={orbitPalette.textSubtle} />
                      <Text style={[styles.eta, { color: orbitPalette.textMuted }]}>
                        ~{step.estimatedMinutes}m
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: 'row', gap: space.md },
  rail: { width: 40, alignItems: 'center' },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  connector: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 3,
    gap: 4,
    minHeight: 32,
  },
  railLine: {
    width: 2,
    flex: 1,
    minHeight: 6,
    borderRadius: 1,
  },
  drivePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  driveText: {
    fontSize: 10,
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
  },
  body: { flex: 1, paddingBottom: space.md, paddingTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  title: {
    ...typography.callout,
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { ...typography.caption2, flexShrink: 1 },
  badges: { alignItems: 'flex-end', gap: 5 },
  catPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  catText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  eta: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
  },
});
