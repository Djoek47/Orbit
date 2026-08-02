import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { radius, space, typography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

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
        const tileBg = emphasized
          ? `${accent}30`
          : orbitPalette.isDark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.04)';
        const tileBorder = emphasized ? `${accent}55` : orbitPalette.border;

        return (
          <View key={step.id} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.tile,
                  {
                    backgroundColor: tileBg,
                    borderColor: tileBorder,
                  },
                ]}>
                <Text style={styles.emoji}>{step.emoji}</Text>
              </View>
              {!isLast ? (
                <View style={styles.connector}>
                  {[0, 1, 2].map((d) => (
                    <View
                      key={`a-${d}`}
                      style={[
                        styles.dot,
                        { backgroundColor: emphasized ? `${accent}99` : orbitPalette.border },
                      ]}
                    />
                  ))}
                  {typeof step.driveMinutes === 'number' ? (
                    <View
                      style={[
                        styles.drivePill,
                        {
                          backgroundColor: orbitPalette.isDark
                            ? 'rgba(0,0,0,0.35)'
                            : 'rgba(255,255,255,0.7)',
                          borderColor: orbitPalette.border,
                        },
                      ]}>
                      <Text style={[styles.driveText, { color: orbitPalette.textSubtle }]}>
                        {step.driveMinutes}m
                      </Text>
                    </View>
                  ) : null}
                  {[0, 1, 2].map((d) => (
                    <View
                      key={`b-${d}`}
                      style={[
                        styles.dot,
                        { backgroundColor: emphasized ? `${accent}99` : orbitPalette.border },
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
            <View style={styles.body}>
              <View style={styles.titleRow}>
                <View style={{ flex: 1 }}>
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
                    <View style={[styles.catPill, { backgroundColor: `${accent}18` }]}>
                      <Text style={[styles.catText, { color: accent }]}>{step.category}</Text>
                    </View>
                  ) : null}
                  {typeof step.estimatedMinutes === 'number' ? (
                    <View style={styles.metaRow}>
                      <MaterialIcons name="schedule" size={12} color={orbitPalette.textSubtle} />
                      <Text style={[styles.meta, { color: orbitPalette.textMuted }]}>
                        ~{step.estimatedMinutes}m
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: 'row', gap: space.md },
  rail: { width: 36, alignItems: 'center' },
  tile: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  emoji: { fontSize: 18 },
  connector: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 3,
    minHeight: 28,
  },
  dot: { width: 2, height: 5, borderRadius: 1 },
  drivePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  driveText: { fontSize: 9, fontWeight: '600' },
  body: { flex: 1, paddingBottom: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  title: { ...typography.callout, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { ...typography.caption2, flexShrink: 1 },
  badges: { alignItems: 'flex-end', gap: 4 },
  catPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  catText: { fontSize: 10, fontWeight: '700' },
});
