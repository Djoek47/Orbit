import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/orbit/bottom-sheet';
import { SetupMemberWizard } from '@/components/orbit/setup-member-wizard';
import { DEFAULT_REWARD_MODEL } from '@/lib/rewards/reward-model';
import { DEFAULT_REWARD_PACKAGE_ID } from '@/lib/rewards/reward-packages';
import { space, typography } from '@/constants/orbit-theme';
import type { DraftMember } from '@/lib/onboarding/setup-draft';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import type { HouseholdMember } from '@/types/orbit';
import { AppText as Text } from '@/components/orbit/app-text';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  /** Called after a member row is created — use to open their invite sheet. */
  onAdded?: (member: HouseholdMember) => void;
};

/**
 * In-place add-member flow — no navigation away from Settings / Members.
 */
export function AddMemberSheet({ visible, onDismiss, onAdded }: Props) {
  const { c } = useOrbitColors();
  const { accentTheme, household, addOnboardingMembers } = useOrbit();

  const handleConfirm = (draft: DraftMember) => {
    if (!household.id) {
      Alert.alert('Household not ready', 'Finish setup, then try again.');
      return;
    }
    const householdId = household.id;
    void (async () => {
      try {
        const created = await addOnboardingMembers(householdId, [
          {
            name: draft.name.trim(),
            role: draft.role === 'admin' ? 'admin' : 'member',
            avatar: draft.avatar,
            plannedTaskLibraryIds: draft.taskLibraryIds,
          },
        ]);
        onDismiss();
        const member = created[0];
        if (member) onAdded?.(member);
      } catch (err) {
        Alert.alert(
          'Could not add member',
          err instanceof Error ? err.message : 'Try again in a moment.'
        );
      }
    })();
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss} heightRatio={0.92} accentColor={accentTheme.primary}>
      <View style={styles.header}>
        <Text style={[typography.caption1, styles.kicker, { color: c.textSubtle }]}>NEW MEMBER</Text>
        <Text style={[styles.title, { color: c.text }]}>Add to your household</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          Name, role, and look — share their personal invite when you&apos;re ready.
        </Text>
      </View>
      <View style={styles.wizard}>
        <KeyboardAvoidingView
          style={styles.wizardInner}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={12}>
          <SetupMemberWizard
            rewardModel={household.rewardModel ?? DEFAULT_REWARD_MODEL}
            rewardMode={household.rewardMode ?? 'weighted'}
            defaultRewardPackageId={DEFAULT_REWARD_PACKAGE_ID}
            onCancel={onDismiss}
            onConfirm={handleConfirm}
          />
        </KeyboardAvoidingView>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
    paddingBottom: space.xs,
    paddingHorizontal: space.lg,
  },
  kicker: {
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 2,
  },
  wizard: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: -space.lg,
    paddingHorizontal: space.lg,
  },
  wizardInner: {
    flex: 1,
    minHeight: 0,
  },
});
