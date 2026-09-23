import { Pressable, StyleSheet } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { useTourControls } from '@/components/orbit/tour/tour-provider';
import { typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

/** One-line dismissible card for upgrade households (status offered). */
export function TourUpgradeOfferCard() {
  const registry = useTourControls();
  const { c } = useOrbitColors();

  if (!registry?.tourState || registry.tourState.status !== 'offered') return null;

  return (
    <GlassCard style={styles.card}>
      <Text style={[typography.body, { color: c.text, flex: 1 }]}>
        New: a short tour of Choremaxx.
      </Text>
      <Pressable onPress={() => registry.startTour()} hitSlop={8} accessibilityRole="button">
        <Text style={[typography.footnote, { color: c.primary, fontWeight: '700' }]}>
          Take the tour
        </Text>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
