import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, space, typography } from '@/constants/orbit-theme';
import { memberDisplayEmoji } from '@/lib/game-levels';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const EMOJIS = ['📱', '🎬', '🌙', '🍦', '🎮', '✨', '🚲', '🍕', '🎁', '💤', '💵'];
const CATEGORIES = ['Experience', 'Treat', 'Screen', 'Money', 'Privilege', 'Special'] as const;
const CATEGORY_COLORS: Record<string, string> = {
  Experience: '#A78BFA',
  Treat: '#FB923C',
  Screen: '#38BDF8',
  Money: '#F59E0B',
  Privilege: '#2DD4BF',
  Special: '#F472B6',
};

export default function CreateRewardScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, createReward, currentMember, household, orbitPalette, permissions } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('120');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [category, setCategory] = useState<string>('Privilege');
  const [approval, setApproval] = useState('Required');
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

  if (!permissions.canManageHousehold) {
    return (
      <ScrollView
        style={[orbitScreen.container, { backgroundColor: orbitPalette.background }]}
        contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ChoremaxxBadge />
        <Text style={[typography.title2, { marginTop: 16, color: c.text }]}>Minting locked</Text>
        <Text style={[typography.body, { color: c.textSoft }]}>
          Only household owners and admins can mint shop rewards.
        </Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back
        </OrbitButton>
      </ScrollView>
    );
  }

  const handleSave = async () => {
    if (!title.trim() || Number(cost) <= 0) return;
    setBusy(true);
    try {
      const assigned = assignableMembers.find((member) => member.id === assignMemberId);
      await createReward({
        title: title.trim(),
        cost: Number(cost),
        approvalRequired: approval === 'Required',
        emoji,
        category,
        color: CATEGORY_COLORS[category],
        origin: 'minted',
        createdByMemberId: currentMember?.id,
        createdByName: currentMember?.name,
        assignedMemberId: assigned?.id,
        assignedMemberName: assigned?.name,
      });
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={[orbitScreen.container, { backgroundColor: orbitPalette.background }]}
      contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={orbitScreen.header}>
        <ChoremaxxBadge />
        <Text style={[typography.footnote, { marginTop: 8, color: c.textMuted }]}>Admin mint</Text>
        <Text style={[typography.title1, { color: c.text }]}>Mint reward</Text>
        <Text style={[typography.body, { color: c.textSoft }]}>
          Add to the vault for everyone, or assign to one person when you mint.
        </Text>
      </View>

      <GlassCard style={styles.card}>
        <OrbitInput label="Title" value={title} onChangeText={setTitle} placeholder="30 minutes screen time" />
        <OrbitInput keyboardType="number-pad" label="XP cost" value={cost} onChangeText={setCost} />
        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((item) => {
            const active = category === item;
            return (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? `${CATEGORY_COLORS[item]}33` : glass(0.06),
                    borderColor: active ? `${CATEGORY_COLORS[item]}88` : glassBorder(0.12),
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? CATEGORY_COLORS[item] : c.textSoft },
                  ]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <ChoiceRow label="Emoji" options={EMOJIS} value={emoji} onChange={setEmoji} />
        <ChoiceRow
          label="Approval"
          options={['Required', 'Instant']}
          value={approval}
          onChange={setApproval}
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
                <Text style={styles.chipEmoji}>{memberDisplayEmoji(member)}</Text>
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
        {busy ? 'Saving…' : assignMemberId ? 'Mint & assign' : 'Save to shop'}
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
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 12, fontWeight: '600' },
});
