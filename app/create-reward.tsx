import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, space, typography } from '@/constants/orbit-theme';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import {
  REWARD_FREQUENCY_LABELS,
  REWARD_PRESETS,
  type RewardFrequency,
} from '@/lib/rewards/reward-presets';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

/**
 * Revision C §2 — Create Reward sheet (replaces Mint Reward).
 * No XP cost. No emoji. Frequency-based grants; optional assign + notes.
 */
export default function CreateRewardScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, createReward, currentMember, household, orbitPalette, permissions } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [frequency, setFrequency] = useState<RewardFrequency>('weekly');
  const [quantity, setQuantity] = useState<string | undefined>();
  const [presetId, setPresetId] = useState<string | null>(null);
  const [assignMemberId, setAssignMemberId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const assignableMembers = useMemo(
    () =>
      household.members.filter(
        (member) =>
          member.status === 'active' &&
          member.role !== 'guest' &&
          !isSharedDeviceRole(member.role)
      ),
    [household.members]
  );

  const selectPreset = (id: string) => {
    const preset = REWARD_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setPresetId(id);
    setTitle(preset.title);
    setFrequency(preset.defaultFrequency);
    setQuantity(preset.quantityOptions?.[0]);
    setNotes(preset.subtitle ?? '');
  };

  if (!permissions.canManageHousehold) {
    return (
      <ScrollView
        style={[orbitScreen.container, { backgroundColor: orbitPalette.background }]}
        contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ChoremaxxBadge />
        <Text style={[typography.title2, { marginTop: 16, color: c.text }]}>Create reward locked</Text>
        <Text style={[typography.body, { color: c.textSoft }]}>
          Only household owners and admins can add rewards to the catalogue.
        </Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back
        </OrbitButton>
      </ScrollView>
    );
  }

  const handleSave = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const assigned = assignableMembers.find((member) => member.id === assignMemberId);
      const preset = presetId ? REWARD_PRESETS.find((item) => item.id === presetId) : undefined;
      await createReward({
        title: title.trim(),
        cost: 0,
        approvalRequired: true,
        category: 'Privilege',
        origin: 'minted',
        createdByMemberId: currentMember?.id,
        createdByName: currentMember?.name,
        assignedMemberId: assigned?.id,
        assignedMemberName: assigned?.name,
        frequency,
        quantity,
        subtitle: notes.trim() || preset?.subtitle,
        isCustom: !presetId,
        presetId: presetId ?? undefined,
      });
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const frequencies = (Object.keys(REWARD_FREQUENCY_LABELS) as RewardFrequency[]).map((key) => ({
    key,
    label: REWARD_FREQUENCY_LABELS[key],
  }));

  return (
    <ScrollView
      style={[orbitScreen.container, { backgroundColor: orbitPalette.background }]}
      contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={orbitScreen.header}>
        <ChoremaxxBadge />
        <Text style={[typography.footnote, { marginTop: 8, color: c.textMuted }]}>Rewards</Text>
        <Text style={[typography.title1, { color: c.text }]}>Create reward</Text>
        <Text style={[typography.body, { color: c.textSoft }]}>
          Add a catalogue reward with a frequency. No XP cost — rewards are granted for meeting chores.
        </Text>
      </View>

      <GlassCard style={styles.card}>
        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Presets</Text>
        <View style={styles.chipRow}>
          {REWARD_PRESETS.map((preset) => {
            const active = presetId === preset.id;
            return (
              <Pressable
                key={preset.id}
                onPress={() => selectPreset(preset.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? `${accentTheme.primary}33` : glass(0.06),
                    borderColor: active ? `${accentTheme.primary}88` : glassBorder(0.12),
                  },
                ]}>
                <Text
                  style={[styles.chipText, { color: active ? accentTheme.primary : c.textSoft }]}>
                  {preset.title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <OrbitInput
          label="Reward name"
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            setPresetId(null);
          }}
          placeholder="Additional screen time"
        />

        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Frequency</Text>
        <View style={styles.chipRow}>
          {frequencies.map((item) => {
            const active = frequency === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFrequency(item.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? `${accentTheme.primary}33` : glass(0.06),
                    borderColor: active ? `${accentTheme.primary}88` : glassBorder(0.12),
                  },
                ]}>
                <Text
                  style={[styles.chipText, { color: active ? accentTheme.primary : c.textSoft }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {presetId &&
        REWARD_PRESETS.find((item) => item.id === presetId)?.quantityOptions?.length ? (
          <>
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Quantity</Text>
            <View style={styles.chipRow}>
              {REWARD_PRESETS.find((item) => item.id === presetId)!.quantityOptions!.map((option) => {
                const active = quantity === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setQuantity(option)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? `${accentTheme.primary}33` : glass(0.06),
                        borderColor: active ? `${accentTheme.primary}88` : glassBorder(0.12),
                      },
                    ]}>
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? accentTheme.primary : c.textSoft },
                      ]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <OrbitInput
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Must be finished before 9pm"
        />

        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Assign to</Text>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => setAssignMemberId(null)}
            style={[
              styles.chip,
              {
                backgroundColor: !assignMemberId ? `${accentTheme.primary}33` : glass(0.06),
                borderColor: !assignMemberId ? `${accentTheme.primary}88` : glassBorder(0.12),
              },
            ]}>
            <Text
              style={[
                styles.chipText,
                { color: !assignMemberId ? accentTheme.primary : c.textSoft },
              ]}>
              Everyone
            </Text>
          </Pressable>
          {assignableMembers.map((member) => {
            const active = assignMemberId === member.id;
            return (
              <Pressable
                key={member.id}
                onPress={() => setAssignMemberId(member.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? `${accentTheme.primary}33` : glass(0.06),
                    borderColor: active ? `${accentTheme.primary}88` : glassBorder(0.12),
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? accentTheme.primary : c.textSoft },
                  ]}>
                  {member.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <OrbitButton disabled={busy || !title.trim()} onPress={() => void handleSave()}>
        {busy ? 'Saving…' : assignMemberId ? 'Create & assign' : 'Save to catalogue'}
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
});
