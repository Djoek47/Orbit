import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, space, typography } from '@/constants/orbit-theme';
import { VOCAB } from '@/constants/vocabulary';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { isMemberFullyConnected } from '@/lib/household/member-connection';
import {
  REWARD_FREQUENCY_LABELS,
  REWARD_PRESETS,
  type RewardFrequency,
} from '@/lib/rewards/reward-presets';
import { MemberGlyph } from '@/components/orbit/member-glyph';
import { Moji } from '@/components/orbit/moji/moji';
import { rewardLook } from '@/lib/rewards/reward-look';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

/**
 * Create or edit a catalogue reward.
 * Open `/create-reward` to mint, `/create-reward?id=` to edit.
 */
export default function CreateRewardScreen() {
  const insets = useSafeAreaInsets();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const {
    accentTheme,
    archiveReward,
    createReward,
    currentMember,
    household,
    orbitPalette,
    permissions,
    updateReward,
  } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();

  const existing = useMemo(
    () => (editId ? household.rewards.find((item) => item.id === editId && !item.archived) : null),
    [editId, household.rewards]
  );
  const isEditing = Boolean(existing);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.subtitle ?? '');
  const [frequency, setFrequency] = useState<RewardFrequency>(
    (existing?.frequency as RewardFrequency | undefined) ?? 'weekly'
  );
  const [quantity, setQuantity] = useState<string | undefined>(existing?.quantity);
  const [presetId, setPresetId] = useState<string | null>(existing?.presetId ?? null);
  const [assignMemberId, setAssignMemberId] = useState<string | null>(
    existing?.assignedMemberId ?? null
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setNotes(existing.subtitle ?? '');
    setFrequency((existing.frequency as RewardFrequency | undefined) ?? 'weekly');
    setQuantity(existing.quantity);
    setPresetId(existing.presetId ?? null);
    setAssignMemberId(existing.assignedMemberId ?? null);
  }, [existing]);

  const assignableMembers = useMemo(
    () =>
      household.members.filter(
        (member) =>
          isMemberFullyConnected(member) &&
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
        <Text style={[typography.title2, { marginTop: 16, color: c.text }]}>Rewards locked</Text>
        <Text style={[typography.body, { color: c.textSoft }]}>
          Only household owners and admins can add or edit rewards.
        </Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back
        </OrbitButton>
      </ScrollView>
    );
  }

  if (editId && !existing) {
    return (
      <ScrollView
        style={[orbitScreen.container, { backgroundColor: orbitPalette.background }]}
        contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ChoremaxxBadge />
        <Text style={[typography.title2, { marginTop: 16, color: c.text }]}>Reward not found</Text>
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
      if (isEditing && existing) {
        await updateReward({
          ...existing,
          title: title.trim(),
          approvalRequired: existing.approvalRequired,
          category: existing.category ?? 'Privilege',
          assignedMemberId: assigned?.id,
          assignedMemberName: assigned?.name,
          frequency,
          quantity,
          subtitle: notes.trim() || preset?.subtitle,
          isCustom: !presetId,
          presetId: presetId ?? undefined,
        });
      } else {
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
      }
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = () => {
    if (!existing) return;
    Alert.alert('Remove reward?', `“${existing.title}” will leave the catalogue.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await archiveReward(existing.id);
              router.back();
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const look = rewardLook({ presetId, title });
  const assignedName = assignableMembers.find((m) => m.id === assignMemberId)?.name;

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
        <Text style={[typography.title1, { color: c.text }]}>
          {isEditing ? 'Edit reward' : 'Mint a reward'}
        </Text>
      </View>

      {/* The reward as it will look on the shelf — it fills in as you choose. */}
      <Animated.View entering={FadeInDown.springify().damping(18)}>
        <LinearGradient
          colors={[`${look.color}3D`, `${look.color}0F`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.preview, { borderColor: `${look.color}55` }]}>
          <View style={[styles.previewMoji, { backgroundColor: `${look.color}26` }]}>
            <Moji name={look.moji} size={40} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.previewTitle, { color: c.text }]} numberOfLines={2}>
              {title.trim() || 'Your reward'}
            </Text>
            <Text style={[styles.previewMeta, { color: look.color }]}>
              {REWARD_FREQUENCY_LABELS[frequency]}
              {quantity ? ` · ${quantity}` : ''}
              {assignedName ? ` · ${assignedName}` : ' · Everyone'}
            </Text>
            {notes.trim() ? (
              <Text style={[styles.previewNote, { color: c.textMuted }]} numberOfLines={2}>
                {notes.trim()}
              </Text>
            ) : null}
          </View>
        </LinearGradient>
      </Animated.View>

      <GlassCard style={styles.card}>
        {!isEditing ? (
          <>
            <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Start from one of these</Text>
            <View style={styles.tiles}>
              {REWARD_PRESETS.map((preset, index) => {
                const active = presetId === preset.id;
                const tone = rewardLook({ presetId: preset.id, title: preset.title });
                return (
                  <Animated.View
                    key={preset.id}
                    entering={FadeInDown.delay(40 + index * 30).springify().damping(18)}
                    style={styles.tileWrap}>
                    <Pressable
                      onPress={() => selectPreset(preset.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${preset.title}, ${REWARD_FREQUENCY_LABELS[preset.defaultFrequency]}`}
                      style={({ pressed }) => [
                        styles.tile,
                        {
                          backgroundColor: active ? `${tone.color}2E` : glass(0.05),
                          borderColor: active ? `${tone.color}99` : glassBorder(0.1),
                          transform: [{ scale: pressed ? 0.97 : 1 }],
                        },
                      ]}>
                      <View style={[styles.tileMoji, { backgroundColor: `${tone.color}22` }]}>
                        <Moji name={tone.moji} size={26} />
                      </View>
                      <Text style={[styles.tileTitle, { color: c.text }]} numberOfLines={2}>
                        {preset.title}
                      </Text>
                      <Text style={[styles.tileMeta, { color: tone.color }]}>
                        {REWARD_FREQUENCY_LABELS[preset.defaultFrequency]}
                      </Text>
                      {active ? (
                        <View style={[styles.tileTick, { backgroundColor: tone.color }]}>
                          <MaterialIcons name="check" size={13} color="#041018" />
                        </View>
                      ) : null}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </>
        ) : null}

        <OrbitInput
          label="Reward name"
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            setPresetId(null);
          }}
          placeholder="Additional screen time"
        />

        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>How often it can be claimed</Text>
        <View style={styles.chipRow}>
          {frequencies.map((item) => {
            const active = frequency === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFrequency(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.bigChip,
                  {
                    backgroundColor: active ? `${look.color}2E` : glass(0.05),
                    borderColor: active ? `${look.color}88` : glassBorder(0.1),
                  },
                ]}>
                <MaterialIcons
                  name={item.key === 'daily' ? 'wb-sunny' : item.key === 'weekly' ? 'date-range' : 'event'}
                  size={16}
                  color={active ? look.color : c.textMuted}
                />
                <Text style={[styles.bigChipText, { color: active ? look.color : c.textSoft }]}>
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
            accessibilityRole="button"
            accessibilityState={{ selected: !assignMemberId }}
            style={[
              styles.bigChip,
              {
                backgroundColor: !assignMemberId ? `${look.color}2E` : glass(0.05),
                borderColor: !assignMemberId ? `${look.color}88` : glassBorder(0.1),
              },
            ]}>
            <Moji name="home" size={17} />
            <Text style={[styles.bigChipText, { color: !assignMemberId ? look.color : c.textSoft }]}>
              Everyone
            </Text>
          </Pressable>
          {assignableMembers.map((member) => {
            const active = assignMemberId === member.id;
            return (
              <Pressable
                key={member.id}
                onPress={() => setAssignMemberId(member.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.bigChip,
                  {
                    backgroundColor: active ? `${look.color}2E` : glass(0.05),
                    borderColor: active ? `${look.color}88` : glassBorder(0.1),
                  },
                ]}>
                <MemberGlyph member={member} size={18} />
                <Text style={[styles.bigChipText, { color: active ? look.color : c.textSoft }]}>
                  {member.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <OrbitButton disabled={busy || !title.trim()} onPress={() => void handleSave()}>
        {busy
          ? 'Saving…'
          : isEditing
            ? 'Save changes'
            : assignMemberId
              ? 'Mint & assign'
              : VOCAB.mintAReward}
      </OrbitButton>
      {isEditing ? (
        <OrbitButton tone="danger" disabled={busy} onPress={handleRemove}>
          Remove reward
        </OrbitButton>
      ) : null}
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  preview: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: space.md,
    padding: 16,
  },
  previewMoji: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  previewMeta: { fontSize: 13, fontWeight: '800' },
  previewNote: { fontSize: 12.5, lineHeight: 17 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tileWrap: { width: '48%' },
  tile: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    minHeight: 116,
    padding: 12,
  },
  tileMoji: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 14.5, fontWeight: '700', letterSpacing: -0.2 },
  tileMeta: { fontSize: 11.5, fontWeight: '800' },
  tileTick: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigChip: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  bigChipText: { fontSize: 14, fontWeight: '700' },
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
