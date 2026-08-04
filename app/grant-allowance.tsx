import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitScreen, space, typography } from '@/constants/orbit-theme';
import { memberDisplayEmoji } from '@/lib/game-levels';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

/** Money-only amounts (§8.2) — no privilege chips. */
const AMOUNTS = ['$5', '$10', '$15', '$20', '$25', '$50'];

export default function GrantAllowanceScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, grantAllowance, household, v2Permissions } = useOrbit();
  const { c } = useOrbitColors();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [amountLabel, setAmountLabel] = useState('$5');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const members = useMemo(
    () =>
      household.members.filter(
        (member) =>
          member.status === 'active' &&
          member.role !== 'guest' &&
          !isSharedDeviceRole(member.role)
      ),
    [household.members]
  );

  if (!v2Permissions.canSendAllowance) {
    return (
      <ScrollView
        style={orbitScreen.container}
        contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={typography.title2}>Admins only</Text>
        <OrbitButton tone="secondary" onPress={() => router.back()}>
          Back
        </OrbitButton>
      </ScrollView>
    );
  }

  const selected = members.find((member) => member.id === memberId);

  const handleGrant = async () => {
    if (!selected || !amountLabel.trim()) return;
    setBusy(true);
    try {
      await grantAllowance({
        memberId: selected.id,
        memberName: selected.name,
        amountLabel: amountLabel.trim(),
        note: note.trim() || undefined,
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
        <Text style={[typography.footnote, { marginTop: 8 }]}>Admin</Text>
        <Text style={typography.title1}>Send Allowance</Text>
        <Text style={typography.body}>Person → amount → optional note.</Text>
      </View>

      <GlassCard style={styles.card}>
        <Text style={[styles.label, { color: c.textMuted }]}>Person</Text>
        <View style={styles.chipRow}>
          {members.map((member) => {
            const active = memberId === member.id;
            return (
              <Pressable
                key={member.id}
                onPress={() => setMemberId(member.id)}
                style={[
                  styles.chip,
                  active && {
                    backgroundColor: `${accentTheme.primary}33`,
                    borderColor: `${accentTheme.primary}88`,
                  },
                ]}>
                <Text style={styles.emoji}>{memberDisplayEmoji(member)}</Text>
                <Text
                  style={[
                    styles.chipText,
                    { color: c.textSoft },
                    active && { color: accentTheme.primary },
                  ]}>
                  {member.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.label, { color: c.textMuted }]}>Amount</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {AMOUNTS.map((preset) => {
            const active = amountLabel === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => setAmountLabel(preset)}
                style={[
                  styles.chip,
                  active && {
                    backgroundColor: `${accentTheme.primary}33`,
                    borderColor: `${accentTheme.primary}88`,
                  },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: c.textSoft },
                    active && { color: accentTheme.primary },
                  ]}>
                  {preset}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <OrbitInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="For this week" />
      </GlassCard>

      <OrbitButton disabled={busy || !selected || !amountLabel.trim()} onPress={() => void handleGrant()}>
        {busy ? 'Sending…' : selected ? `Send Allowance to ${selected.name}` : 'Pick a person'}
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  emoji: { fontSize: 16 },
});
