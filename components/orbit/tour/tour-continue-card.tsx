import { Pressable, StyleSheet } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { useTourControls } from '@/components/orbit/tour/tour-provider';
import { typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

/** Home card when a tour was left mid-way — never auto-resumes the overlay. */
export function TourContinueCard() {
  const registry = useTourControls();
  const { c } = useOrbitColors();

  if (!registry?.awaitingContinue) return null;

  return (
    <GlassCard style={styles.card}>
      <Text style={[typography.body, { color: c.text, flex: 1 }]}>Continue the tour?</Text>
      <Pressable onPress={() => registry.continueTour()} hitSlop={8} accessibilityRole="button">
        <Text style={[typography.footnote, { color: c.primary, fontWeight: '700' }]}>Continue</Text>
      </Pressable>
      <Pressable onPress={() => registry.startTour(registry.tourState?.tourId)} hitSlop={8}>
        <Text style={[typography.footnote, { color: c.textSubtle }]}>Restart</Text>
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
