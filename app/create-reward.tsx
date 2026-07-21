import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceRow } from '@/components/orbit/choice-row';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

const EMOJIS = ['📱', '🎬', '🌙', '🍦', '🎮', '✨', '🚲', '🍕', '🎁', '💤'];
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
  const { accentTheme, createReward, currentMember, permissions } = useOrbit();
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('120');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [category, setCategory] = useState<string>('Privilege');
  const [approval, setApproval] = useState('Required');
  const [busy, setBusy] = useState(false);

  if (!permissions.canManageHousehold) {
    return (
      <ScrollView
        style={orbitScreen.container}
        contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ChoremaxxBadge />
        <Text style={[orbitTypography.title, { marginTop: 16 }]}>Minting locked</Text>
        <Text style={orbitTypography.body}>Only household owners and admins can mint shop rewards.</Text>
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
      });
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={orbitScreen.header}>
        <ChoremaxxBadge />
        <Text style={[orbitTypography.caption, { marginTop: 8 }]}>Admin mint</Text>
        <Text style={orbitTypography.display}>Mint reward</Text>
        <Text style={orbitTypography.body}>
          Catalog rewards for everyone. Origin stays “Minted” so admins can audit the shop.
        </Text>
      </View>

      <GlassCard style={styles.card}>
        <OrbitInput label="Title" value={title} onChangeText={setTitle} placeholder="30 minutes screen time" />
        <OrbitInput keyboardType="number-pad" label="XP cost" value={cost} onChangeText={setCost} />
        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((item) => {
            const active = category === item;
            return (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[
                  styles.chip,
                  active && {
                    backgroundColor: `${CATEGORY_COLORS[item]}33`,
                    borderColor: `${CATEGORY_COLORS[item]}88`,
                  },
                ]}>
                <Text style={[styles.chipText, active && { color: CATEGORY_COLORS[item] }]}>{item}</Text>
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
      </GlassCard>

      <OrbitButton disabled={busy || !title.trim()} onPress={() => void handleSave()}>
        {busy ? 'Saving…' : 'Save to shop'}
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { gap: orbitSpacing.md },
  fieldLabel: {
    color: orbitColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { color: orbitColors.textSoft, fontSize: 12, fontWeight: '600' },
});
