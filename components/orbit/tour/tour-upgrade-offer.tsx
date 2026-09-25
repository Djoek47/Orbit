import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { useTourControls } from '@/components/orbit/tour/tour-provider';
import { radius, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

/** One-line dismissible card for upgrade households (status offered). */
export function TourUpgradeOfferCard() {
  const registry = useTourControls();
  const { c, glassBorder } = useOrbitColors();

  if (!registry?.tourState || registry.tourState.status !== 'offered') return null;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <View style={styles.copy}>
          <Text style={[typography.headline, { color: c.text }]}>A short tour</Text>
          <Text style={[typography.caption1, { color: c.textMuted }]}>
            See how Choremaxx fits together. Close it if you would rather explore.
          </Text>
        </View>
        <Pressable
          onPress={() => registry.dismissTourPrompt()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close tour offer"
          style={[styles.close, { borderColor: glassBorder(0.16) }]}>
          <MaterialIcons name="close" size={18} color={c.textMuted} />
        </Pressable>
      </View>
      <Pressable
        onPress={() => registry.startTour()}
        accessibilityRole="button"
        style={[styles.go, { backgroundColor: `${c.primary}22` }]}>
        <Text style={[typography.footnote, { color: c.primary, fontWeight: '700' }]}>
          Take the tour
        </Text>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  head: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  go: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 18,
  },
  close: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
