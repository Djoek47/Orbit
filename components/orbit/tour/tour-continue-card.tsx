import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { useTourControls } from '@/components/orbit/tour/tour-provider';
import { radius, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

/** Home card when a tour was left mid-way — never auto-resumes the overlay. */
export function TourContinueCard() {
  const registry = useTourControls();
  const { c, glassBorder } = useOrbitColors();

  if (!registry?.awaitingContinue) return null;
  if (registry.tourState?.status === 'completed') return null;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <View style={styles.copy}>
          <Text style={[typography.headline, { color: c.text }]}>Continue the tour?</Text>
          <Text style={[typography.caption1, { color: c.textMuted }]}>
            Pick up where you left off, or close this for good.
          </Text>
        </View>
        <Pressable
          onPress={() => registry.dismissTourPrompt()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close tour prompt"
          style={[styles.close, { borderColor: glassBorder(0.16) }]}>
          <MaterialIcons name="close" size={18} color={c.textMuted} />
        </Pressable>
      </View>
      <Pressable
        onPress={() => registry.continueTour()}
        accessibilityRole="button"
        style={[styles.continueBtn, { backgroundColor: `${c.primary}22` }]}>
        <Text style={[typography.footnote, { color: c.primary, fontWeight: '700' }]}>Continue</Text>
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
  continueBtn: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    minHeight: 40,
    justifyContent: 'center',
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
