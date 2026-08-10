/**
 * Revision F §11.2 — Create allowance (Daily / Weekly / Monthly only).
 */
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { GlassCard } from '@/components/orbit/glass-card';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { orbitColors, orbitScreen, typography } from '@/constants/orbit-theme';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import {
  type AllowanceFrequency,
  type AllowanceRule,
} from '@/lib/rewards/allowance-progress';
import { upsertAllowanceRule } from '@/lib/rewards/allowance-rules-store';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function CreateAllowanceScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { household, permissions, accentTheme } = useOrbit();
  const [amount, setAmount] = useState('5.00');
  const [frequency, setFrequency] = useState<AllowanceFrequency>('weekly');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const members = useMemo(
    () =>
      household.members.filter(
        (m) => m.status === 'active' && m.role !== 'guest' && !isSharedDeviceRole(m.role)
      ),
    [household.members]
  );

  const create = async () => {
    if (!permissions.canManageHousehold) {
      Alert.alert('Admins only', 'Only an admin can create an allowance.');
      return;
    }
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Amount needed', 'Enter a positive amount.');
      return;
    }
    const member = members.find((m) => m.id === memberId);
    if (!member || !household.id) {
      Alert.alert('Assign to', 'Pick who earns this allowance.');
      return;
    }
    setBusy(true);
    try {
      const rule: AllowanceRule = {
        id: `allow-${member.id}-${Date.now()}`,
        householdId: household.id,
        memberId: member.id,
        memberName: member.name,
        amount: parsed,
        currency: 'CAD',
        frequency,
        active: true,
        createdAt: new Date().toISOString(),
      };
      await upsertAllowanceRule(household.id, rule);
      Alert.alert(
        'Allowance created',
        'ChoreMaxx keeps the record — you hand over the money yourself.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <PersistentScrollView
      style={[orbitScreen.container, { backgroundColor: c.background }]}
      contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={orbitScreen.header}>
        <Text style={[typography.footnote, { color: c.textMuted }]}>Allowance</Text>
        <Text style={[typography.title1, { color: c.text }]}>Create an allowance</Text>
        <Text style={[typography.body, { color: c.textSoft }]}>
          Set an amount and how often it&apos;s earned. ChoreMaxx keeps the record — you hand over
          the money yourself.
        </Text>
      </View>

      <GlassCard style={styles.card}>
        <Text style={[styles.label, { color: c.textMuted }]}>Amount</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="$ 5.00"
          placeholderTextColor={c.textSubtle}
          style={[
            styles.input,
            { color: c.text, borderColor: glassBorder(0.12), backgroundColor: glass(0.05) },
          ]}
        />

        <Text style={[styles.label, { color: c.textMuted }]}>How often</Text>
        <View style={styles.row}>
          {(['daily', 'weekly', 'monthly'] as AllowanceFrequency[]).map((f) => {
            const active = frequency === f;
            return (
              <Pressable
                key={f}
                onPress={() => setFrequency(f)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? `${accentTheme.primary}33` : glass(0.06),
                    borderColor: active ? `${accentTheme.primary}88` : glassBorder(0.12),
                  },
                ]}>
                <Text style={{ color: active ? accentTheme.primary : c.textSoft, fontWeight: '600' }}>
                  {f[0]!.toUpperCase() + f.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: c.textMuted }]}>Assign to</Text>
        <View style={styles.row}>
          {members.map((m) => {
            const active = memberId === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMemberId(m.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? `${accentTheme.primary}33` : glass(0.06),
                    borderColor: active ? `${accentTheme.primary}88` : glassBorder(0.12),
                  },
                ]}>
                <Text style={{ color: active ? accentTheme.primary : c.textSoft, fontWeight: '600' }}>
                  {m.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          disabled={busy}
          onPress={() => void create()}
          style={[styles.cta, { backgroundColor: accentTheme.primary, opacity: busy ? 0.7 : 1 }]}>
          <Text style={[typography.headline, { color: orbitColors.ink }]}>Create allowance</Text>
        </Pressable>
      </GlassCard>
    </PersistentScrollView>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cta: {
    alignItems: 'center',
    borderRadius: 14,
    marginTop: 8,
    paddingVertical: 14,
  },
});
