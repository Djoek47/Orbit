import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { memberDisplayEmoji } from '@/lib/game-levels';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import { useOrbit } from '@/store/orbit-store';

const PRESETS = ['$5', '$10', '$20', 'Extra screen', 'Treat night'];

export default function GrantAllowanceScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, grantAllowance, household, permissions } = useOrbit();
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

  if (!permissions.canManageHousehold) {
    return (
      <ScrollView
        style={orbitScreen.container}
        contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={orbitTypography.title}>Admins only</Text>
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
        <Text style={[orbitTypography.caption, { marginTop: 8 }]}>Admin</Text>
        <Text style={orbitTypography.display}>Grant allowance</Text>
        <Text style={orbitTypography.body}>
          Give a cash or privilege allowance to one person. They get a notification right away.
        </Text>
      </View>

      <GlassCard style={styles.card}>
        <Text style={styles.label}>Person</Text>
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
                <Text style={[styles.chipText, active && { color: accentTheme.primary }]}>
                  {member.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.label}>Amount</Text>
        <View style={styles.chipRow}>
          {PRESETS.map((preset) => {
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
                <Text style={[styles.chipText, active && { color: accentTheme.primary }]}>
                  {preset}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <OrbitInput label="Custom label" value={amountLabel} onChangeText={setAmountLabel} />
        <OrbitInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="Weekend treat" />
      </GlassCard>

      <OrbitButton disabled={busy || !selected || !amountLabel.trim()} onPress={() => void handleGrant()}>
        {busy ? 'Granting…' : selected ? `Grant to ${selected.name}` : 'Pick a person'}
      </OrbitButton>
      <OrbitButton tone="secondary" onPress={() => router.back()}>
        Cancel
      </OrbitButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { gap: orbitSpacing.md },
  label: {
    color: orbitColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: orbitColors.textSoft, fontSize: 13, fontWeight: '600' },
  emoji: { fontSize: 14 },
});
