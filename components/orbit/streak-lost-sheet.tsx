import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { VOCAB } from '@/constants/vocabulary';
import { space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  visible: boolean;
  streakDays: number;
  reason?: string | null;
  onDismiss: () => void;
};

/**
 * Cliff “streak lost” — shown when rescue is unavailable (Rev D §1.4 / §7).
 */
export function StreakLostSheet({ visible, streakDays, reason, onDismiss }: Props) {
  const { c } = useOrbitColors();
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} heightRatio={0.42}>
      <View style={styles.body}>
        <Text style={[typography.caption1, { color: c.textMuted }]}>Streak</Text>
        <Text style={[typography.title2, { color: c.text }]}>
          Your streak ended at {streakDays} days
        </Text>
        <Text style={[typography.body, { color: c.textSoft }]}>
          {reason === 'rolling'
            ? 'Too many quiet days in a row — the streak reset.'
            : 'Rescue wasn’t available this time. Start fresh on your next completed task.'}
        </Text>
        <Text style={[typography.footnote, { color: c.textMuted }]}>
          {VOCAB.rescueDoesNotRestoreTasks}
        </Text>
        <OrbitButton onPress={onDismiss}>Got it</OrbitButton>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={[typography.footnote, { color: c.accent, textAlign: 'center' }]}>
            Close
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingBottom: space.lg },
});
