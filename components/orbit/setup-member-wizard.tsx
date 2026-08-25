/**
 * Add-member wizard A→D (§3.5).
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { OrbitButton } from '@/components/orbit/orbit-button';
import { Avatar } from '@/components/orbit/avatar';
import { PersonalizeLookSheet } from '@/components/orbit/personalize-look-sheet';
import { TaskPicker } from '@/components/orbit/task-picker';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isAvatarImageUri, memberDisplayEmoji } from '@/lib/game-levels';
import { hasChosenAvatar } from '@/lib/profile/chosen-avatar';
import {
  AVATAR_SWATCHES,
  newDraftMemberId,
  type DraftMember,
  type DraftMemberAllowance,
  type DraftMemberReward,
} from '@/lib/onboarding/setup-draft';
import { type RewardMode } from '@/lib/rewards/reward-mode';
import { capabilitiesFor, type RewardModel } from '@/lib/rewards/reward-model';
import {
  REWARD_FREQUENCY_LABELS,
  REWARD_PRESETS,
  type RewardFrequency,
} from '@/lib/rewards/reward-presets';
import { allLibraryTasks } from '@/lib/tasks/task-library';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';

type WizardStep = 'A' | 'B' | 'C' | 'D';

type SetupMemberWizardProps = {
  rewardModel: RewardModel;
  /** Meritocracy / Equity — drives XP labels in the task picker before household exists. */
  rewardMode?: RewardMode;
  initial?: DraftMember | null;
  onCancel: () => void;
  onConfirm: (member: DraftMember) => void;
};

const STEPS: WizardStep[] = ['A', 'B', 'C', 'D'];

function emptyMember(): DraftMember {
  return {
    id: newDraftMemberId(),
    name: '',
    role: 'member',
    avatarColor: AVATAR_SWATCHES[0],
    taskLibraryIds: [],
    rewards: [],
    allowance: null,
    setupComplete: false,
  };
}

export function SetupMemberWizard({
  rewardModel,
  rewardMode = 'weighted',
  initial,
  onCancel,
  onConfirm,
}: SetupMemberWizardProps) {
  const { c, glass, glassBorder } = useOrbitColors();
  const caps = capabilitiesFor(rewardModel);
  const skipRewards = !caps.rewardsEnabled && !caps.allowanceEnabled;

  const [member, setMember] = useState<DraftMember>(() =>
    initial ? { ...initial, rewards: [...initial.rewards] } : emptyMember()
  );
  const [step, setStep] = useState<WizardStep>('A');
  const [lookSheetOpen, setLookSheetOpen] = useState(false);

  const visibleSteps = useMemo(
    () => (skipRewards ? (['A', 'B', 'D'] as WizardStep[]) : STEPS),
    [skipRewards]
  );
  const stepIndex = visibleSteps.indexOf(step);
  const libraryById = useMemo(() => new Map(allLibraryTasks().map((t) => [t.id, t])), []);

  const goNext = () => {
    if (step === 'A') {
      setStep('B');
      return;
    }
    if (step === 'B') {
      setStep(skipRewards ? 'D' : 'C');
      return;
    }
    if (step === 'C') {
      setStep('D');
    }
  };

  const goBack = () => {
    if (step === 'D') {
      setStep(skipRewards ? 'B' : 'C');
      return;
    }
    if (step === 'C') {
      setStep('B');
      return;
    }
    if (step === 'B') {
      setStep('A');
      return;
    }
    onCancel();
  };

  const toggleReward = (presetId: string) => {
    const preset = REWARD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setMember((current) => {
      const exists = current.rewards.find((r) => r.presetId === presetId);
      if (exists) {
        return { ...current, rewards: current.rewards.filter((r) => r.presetId !== presetId) };
      }
      const next: DraftMemberReward = {
        presetId,
        title: preset.title,
        frequency: preset.defaultFrequency,
        quantity: preset.quantityOptions?.[0],
      };
      return { ...current, rewards: [...current.rewards, next] };
    });
  };

  const setRewardFrequency = (presetId: string, frequency: RewardFrequency) => {
    setMember((current) => ({
      ...current,
      rewards: current.rewards.map((r) => (r.presetId === presetId ? { ...r, frequency } : r)),
    }));
  };

  const setAllowance = (patch: Partial<DraftMemberAllowance>) => {
    setMember((current) => ({
      ...current,
      allowance: {
        amount: current.allowance?.amount ?? 5,
        frequency: current.allowance?.frequency ?? 'weekly',
        ...patch,
      },
    }));
  };

  const confirm = () => {
    onConfirm({
      ...member,
      name: member.name.trim(),
      setupComplete: true,
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.progress}>
        {visibleSteps.map((s, i) => (
          <View
            key={s}
            style={[
              styles.dot,
              {
                backgroundColor: i <= stepIndex ? c.primary : glassBorder(0.2),
              },
            ]}
          />
        ))}
      </View>

      {step === 'A' ? (
        <View style={styles.block}>
          <Text style={[typography.title2, { color: c.text }]}>What&apos;s their name?</Text>
          <Pressable
            onPress={() => setLookSheetOpen(true)}
            style={styles.photoRow}
            accessibilityRole="button"
            accessibilityLabel={
              hasChosenAvatar(member.avatar)
                ? `Change photo for ${member.name.trim() || 'this person'}`
                : 'Choose a profile picture'
            }>
            <Avatar
              name={member.name.trim() || 'New'}
              emoji={
                member.avatar && !isAvatarImageUri(member.avatar)
                  ? member.avatar
                  : memberDisplayEmoji({ name: member.name.trim() || 'New', avatar: member.avatar })
              }
              imageUri={isAvatarImageUri(member.avatar) ? member.avatar : undefined}
              size="l"
            />
            <View style={{ flex: 1 }}>
              <Text style={[typography.headline, { color: c.text }]}>
                {hasChosenAvatar(member.avatar) ? 'Change photo' : 'Choose a photo'}
              </Text>
              <Text style={[typography.caption1, { color: c.textMuted, marginTop: 2 }]}>
                {hasChosenAvatar(member.avatar)
                  ? 'Photos, Image Playground, or emoji'
                  : 'No photo yet — pick one if you have it'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={c.textSubtle} />
          </Pressable>
          <TextInput
            value={member.name}
            onChangeText={(name) => setMember((m) => ({ ...m, name }))}
            placeholder="e.g. Emma"
            placeholderTextColor={c.textSubtle}
            style={[
              styles.input,
              { color: c.text, borderColor: glassBorder(0.14), backgroundColor: glass(0.05) },
            ]}
          />
          <Text style={[typography.caption1, { color: c.textMuted }]}>Avatar colour</Text>
          <View style={styles.swatches}>
            {AVATAR_SWATCHES.map((color) => (
              <Pressable
                key={color}
                onPress={() => setMember((m) => ({ ...m, avatarColor: color }))}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: color,
                    borderColor: member.avatarColor === color ? c.text : 'transparent',
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[typography.caption1, { color: c.textMuted }]}>Role</Text>
          <View style={styles.roleRow}>
            {(['member', 'admin'] as const).map((role) => {
              const active = member.role === role;
              return (
                <Pressable
                  key={role}
                  onPress={() => setMember((m) => ({ ...m, role }))}
                  style={[
                    styles.roleChip,
                    {
                      backgroundColor: active ? `${c.primary}22` : glass(0.05),
                      borderColor: active ? `${c.primary}55` : glassBorder(0.12),
                    },
                  ]}>
                  <Text style={{ color: active ? c.primary : c.textMuted, fontWeight: '600' }}>
                    {role === 'admin' ? 'Admin' : 'Sidekick'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <OrbitButton disabled={!member.name.trim()} onPress={goNext}>
            Continue
          </OrbitButton>
          <Pressable onPress={goBack}>
            <Text style={[typography.footnote, { color: c.textSubtle, textAlign: 'center' }]}>
              Back
            </Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'B' ? (
        <View style={[styles.block, { flex: 1 }]}>
          <Text style={[typography.title2, { color: c.text }]}>
            What should {member.name.trim() || 'they'} take care of?
          </Text>
          <Text style={[typography.caption1, { color: c.textMuted }]}>
            {member.taskLibraryIds.length} task
            {member.taskLibraryIds.length === 1 ? '' : 's'} selected
          </Text>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            <TaskPicker
              selectedIds={member.taskLibraryIds}
              onChange={(taskLibraryIds) => setMember((m) => ({ ...m, taskLibraryIds }))}
              rewardMode={rewardMode}
            />
          </ScrollView>
          <OrbitButton onPress={goNext}>
            {member.taskLibraryIds.length > 0 ? 'Continue' : 'Skip for now'}
          </OrbitButton>
          <Pressable onPress={goBack}>
            <Text style={[typography.footnote, { color: c.textSubtle, textAlign: 'center' }]}>
              Back
            </Text>
          </Pressable>
        </View>
      ) : null}

      {step === 'C' ? (
        <ScrollView contentContainerStyle={styles.block}>
          <Text style={[typography.title2, { color: c.text }]}>
            What would you like {member.name.trim() || 'them'} to earn?
          </Text>

          {caps.rewardsEnabled ? (
            <View style={{ gap: 10 }}>
              <Text style={[typography.headline, { color: c.text }]}>Rewards</Text>
              {REWARD_PRESETS.map((preset) => {
                const selected = member.rewards.find((r) => r.presetId === preset.id);
                return (
                  <View
                    key={preset.id}
                    style={[
                      styles.rewardCard,
                      {
                        backgroundColor: selected ? `${c.primary}14` : glass(0.05),
                        borderColor: selected ? `${c.primary}44` : glassBorder(0.1),
                      },
                    ]}>
                    <Pressable onPress={() => toggleReward(preset.id)} style={styles.rewardHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={[typography.headline, { color: c.text }]}>{preset.title}</Text>
                        {preset.subtitle ? (
                          <Text style={[typography.caption1, { color: c.textSubtle }]}>
                            {preset.subtitle}
                          </Text>
                        ) : null}
                      </View>
                      <MaterialIcons
                        name={selected ? 'check-box' : 'check-box-outline-blank'}
                        size={22}
                        color={selected ? c.primary : c.textSubtle}
                      />
                    </Pressable>
                    {selected ? (
                      <View style={styles.freqRow}>
                        {(['daily', 'weekly', 'monthly'] as RewardFrequency[]).map((freq) => {
                          const active = selected.frequency === freq;
                          return (
                            <Pressable
                              key={freq}
                              onPress={() => setRewardFrequency(preset.id, freq)}
                              style={[
                                styles.freqChip,
                                {
                                  backgroundColor: active ? `${c.primary}22` : glass(0.04),
                                  borderColor: active ? `${c.primary}55` : glassBorder(0.1),
                                },
                              ]}>
                              <Text
                                style={{
                                  color: active ? c.primary : c.textMuted,
                                  fontSize: 12,
                                  fontWeight: '600',
                                }}>
                                {REWARD_FREQUENCY_LABELS[freq]}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {caps.allowanceEnabled ? (
            <View style={{ gap: 10, marginTop: caps.rewardsEnabled ? 16 : 0 }}>
              <Text style={[typography.headline, { color: c.text }]}>Allowance</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={member.allowance ? String(member.allowance.amount) : ''}
                onChangeText={(text) => {
                  const amount = Number(text.replace(/[^0-9.]/g, ''));
                  if (!text.trim()) {
                    setMember((m) => ({ ...m, allowance: null }));
                    return;
                  }
                  setAllowance({ amount: Number.isFinite(amount) ? amount : 0 });
                }}
                placeholder="Amount"
                placeholderTextColor={c.textSubtle}
                style={[
                  styles.input,
                  { color: c.text, borderColor: glassBorder(0.14), backgroundColor: glass(0.05) },
                ]}
              />
              <View style={styles.freqRow}>
                {(['daily', 'weekly', 'monthly'] as RewardFrequency[]).map((freq) => {
                  const active = (member.allowance?.frequency ?? 'weekly') === freq;
                  return (
                    <Pressable
                      key={freq}
                      onPress={() => setAllowance({ frequency: freq })}
                      style={[
                        styles.freqChip,
                        {
                          backgroundColor: active ? `${c.primary}22` : glass(0.04),
                          borderColor: active ? `${c.primary}55` : glassBorder(0.1),
                        },
                      ]}>
                      <Text
                        style={{
                          color: active ? c.primary : c.textMuted,
                          fontSize: 12,
                          fontWeight: '600',
                        }}>
                        {REWARD_FREQUENCY_LABELS[freq]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <OrbitButton onPress={goNext}>Continue</OrbitButton>
          <Pressable onPress={goBack}>
            <Text style={[typography.footnote, { color: c.textSubtle, textAlign: 'center' }]}>
              Back
            </Text>
          </Pressable>
        </ScrollView>
      ) : null}

      {step === 'D' ? (
        <ScrollView contentContainerStyle={styles.block}>
          <Text style={[typography.title2, { color: c.text }]}>Review &amp; confirm</Text>
          <View
            style={[
              styles.reviewCard,
              { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
            ]}>
            <View style={styles.reviewHead}>
              <Avatar
                name={member.name.trim() || 'New'}
                emoji={
                  member.avatar && !isAvatarImageUri(member.avatar)
                    ? member.avatar
                    : memberDisplayEmoji({ name: member.name.trim() || 'New', avatar: member.avatar })
                }
                imageUri={isAvatarImageUri(member.avatar) ? member.avatar : undefined}
                size="l"
              />
              <View style={{ flex: 1 }}>
                <Text style={[typography.headline, { color: c.text }]}>{member.name.trim()}</Text>
                <Text style={[typography.caption1, { color: c.textMuted }]}>
                  {member.role === 'admin' ? 'Admin' : 'Sidekick'}
                </Text>
              </View>
              <Pressable onPress={() => setStep('A')}>
                <Text style={{ color: c.primary, fontWeight: '600' }}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.reviewSection}>
              <View style={styles.reviewSectionHead}>
                <Text style={[typography.headline, { color: c.text }]}>Tasks</Text>
                <Pressable onPress={() => setStep('B')}>
                  <Text style={{ color: c.primary, fontWeight: '600' }}>Edit</Text>
                </Pressable>
              </View>
              {member.taskLibraryIds.length === 0 ? (
                <Text style={[typography.caption1, { color: c.textSubtle }]}>None yet</Text>
              ) : (
                member.taskLibraryIds.map((id) => (
                  <Text key={id} style={[typography.footnote, { color: c.textMuted }]}>
                    · {libraryById.get(id)?.name ?? id}
                  </Text>
                ))
              )}
            </View>

            {!skipRewards ? (
              <View style={styles.reviewSection}>
                <View style={styles.reviewSectionHead}>
                  <Text style={[typography.headline, { color: c.text }]}>Earn</Text>
                  <Pressable onPress={() => setStep('C')}>
                    <Text style={{ color: c.primary, fontWeight: '600' }}>Edit</Text>
                  </Pressable>
                </View>
                {member.rewards.map((r) => (
                  <Text key={r.presetId} style={[typography.footnote, { color: c.textMuted }]}>
                    · {r.title} · {REWARD_FREQUENCY_LABELS[r.frequency]}
                    {r.quantity ? ` · ${r.quantity}` : ''}
                  </Text>
                ))}
                {member.allowance ? (
                  <Text style={[typography.footnote, { color: c.textMuted }]}>
                    · Allowance ${member.allowance.amount} ·{' '}
                    {REWARD_FREQUENCY_LABELS[member.allowance.frequency]}
                  </Text>
                ) : null}
                {member.rewards.length === 0 && !member.allowance ? (
                  <Text style={[typography.caption1, { color: c.textSubtle }]}>None yet</Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <OrbitButton onPress={confirm}>Confirm creation</OrbitButton>
          <Pressable onPress={goBack}>
            <Text style={[typography.footnote, { color: c.textSubtle, textAlign: 'center' }]}>
              Back
            </Text>
          </Pressable>
        </ScrollView>
      ) : null}

      <PersonalizeLookSheet
        visible={lookSheetOpen}
        memberName={member.name.trim() || 'them'}
        currentAvatar={member.avatar}
        onDismiss={() => setLookSheetOpen(false)}
        onSelect={(avatar) => {
          setMember((current) => ({ ...current, avatar }));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: space.md },
  progress: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  block: { gap: 14, paddingBottom: 24 },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  swatches: { flexDirection: 'row', gap: 10 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  rewardCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    padding: 12,
    gap: 10,
  },
  rewardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freqChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  reviewCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.cardLarge,
    padding: 14,
    gap: 16,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewSection: { gap: 6 },
  reviewSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
