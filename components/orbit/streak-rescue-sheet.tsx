/**
 * Streak Rescue confirmation prompt — Revision D §1.5.
 * Free first rescue still requires pressing the primary button
 * (confirmedViaPrompt). Decline is plain text, never a competing filled button.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { VOCAB } from '@/constants/vocabulary';
import { space, typography } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

export type StreakRescueOffer = {
  streakDays: number;
  estimatedXpCost: number;
  freeEligible: boolean;
  missedDayLabel?: string;
};

type Props = {
  visible: boolean;
  offer: StreakRescueOffer | null;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss: () => void;
};

export function StreakRescueSheet({ visible, offer, onAccept, onDecline, onDismiss }: Props) {
  const { c } = useOrbitColors();
  if (!offer) return null;

  const primaryLabel = offer.freeEligible
    ? VOCAB.rescueFree
    : `Rescue my streak · about ${offer.estimatedXpCost} XP`;

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} heightRatio={0.42}>
      <View style={styles.body}>
        <Text style={[typography.caption1, { color: c.textMuted }]}>{VOCAB.streakRescue}</Text>
        <Text style={[typography.title2, { color: c.text }]}>
          Keep your {offer.streakDays}-day streak?
        </Text>
        <Text style={[typography.body, { color: c.textSoft }]}>
          {offer.freeEligible
            ? VOCAB.firstRescueOnUs
            : `This uses about ${offer.estimatedXpCost} XP from this week's earnings.`}
        </Text>
        <OrbitButton onPress={onAccept}>{primaryLabel}</OrbitButton>
        <Pressable onPress={onDecline} accessibilityRole="button" style={styles.decline}>
          <Text style={[typography.subheadline, { color: c.textMuted }]}>{VOCAB.keepXpInstead}</Text>
        </Pressable>
        <Text style={[typography.caption1, { color: c.textSubtle, textAlign: 'center' }]}>
          {VOCAB.rescueDoesNotRestoreTasks}
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
  decline: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
});
