/**
 * Revision F §11.2 — Create allowance.
 * Quiet form: amount, period, person — no decoration.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { PersistentScrollView } from '@/components/orbit/persistent-scroll-view';
import { radius, space, typography } from '@/constants/orbit-theme';
import { isSharedDeviceRole } from '@/lib/household/shared-device';
import {
  type AllowanceFrequency,
  type AllowanceRule,
} from '@/lib/rewards/allowance-progress';
import { upsertAllowanceRule } from '@/lib/rewards/allowance-rules-store';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const FREQS: { id: AllowanceFrequency; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

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

  const canSubmit = Boolean(memberId) && !busy;

  return (
    <View style={[styles.shell, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.nav}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={14}
          style={[styles.iconBtn, { backgroundColor: glass(0.06) }]}>
          <MaterialIcons name="close" size={20} color={c.textSoft} />
        </Pressable>
      </View>

      <PersistentScrollView contentContainerStyle={styles.content}>
        <Text style={[typography.caption1, { color: c.textMuted, letterSpacing: 0.4 }]}>
          ALLOWANCE
        </Text>
        <Text style={[typography.title1, { color: c.text, marginTop: space.xs }]}>
          Create an allowance
        </Text>
        <Text style={[typography.body, { color: c.textMuted, marginTop: space.sm, lineHeight: 22 }]}>
          Set an amount and how often it&apos;s earned. ChoreMaxx keeps the record — you hand over
          the money yourself.
        </Text>

        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Amount</Text>
        <View
          style={[
            styles.amountField,
            { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
          ]}>
          <Text style={[styles.currency, { color: c.textSubtle }]}>$</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="5.00"
            placeholderTextColor={c.textSubtle}
            style={[styles.amountInput, { color: c.text }]}
          />
        </View>

        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>How often</Text>
        <View style={[styles.segment, { backgroundColor: glass(0.05) }]}>
          {FREQS.map((f) => {
            const active = frequency === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFrequency(f.id)}
                style={[
                  styles.segmentItem,
                  active && { backgroundColor: `${accentTheme.primary}28` },
                ]}>
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? accentTheme.primary : c.textSoft },
                  ]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Assign to</Text>
        <View style={styles.people}>
          {members.map((m) => {
            const active = memberId === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMemberId(m.id)}
                style={[
                  styles.person,
                  {
                    backgroundColor: active ? `${accentTheme.primary}22` : glass(0.04),
                    borderColor: active ? `${accentTheme.primary}55` : glassBorder(0.08),
                  },
                ]}>
                <Text
                  style={[
                    typography.subheadline,
                    { color: active ? accentTheme.primary : c.textSoft, fontWeight: '600' },
                  ]}>
                  {m.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </PersistentScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, space.md),
            borderTopColor: glassBorder(0.08),
          },
        ]}>
        <Pressable
          disabled={!canSubmit}
          onPress={() => void create()}
          style={[
            styles.cta,
            {
              backgroundColor: canSubmit ? accentTheme.primary : glass(0.08),
              opacity: busy ? 0.65 : 1,
            },
          ]}>
          <Text
            style={[
              typography.headline,
              { color: canSubmit ? c.ink : c.textSubtle, fontWeight: '700' },
            ]}>
            Create allowance
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  nav: {
    paddingHorizontal: space.md,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  iconBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  content: {
    paddingBottom: space.section,
    paddingHorizontal: space.xl,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: space.sm,
    marginTop: space.xxl,
  },
  amountField: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: space.lg,
    paddingVertical: 4,
  },
  currency: { fontSize: 28, fontWeight: '300' },
  amountInput: {
    flex: 1,
    fontSize: 34,
    fontWeight: '600',
    letterSpacing: -0.5,
    paddingVertical: 14,
  },
  segment: {
    borderCurve: 'continuous',
    borderRadius: radius.control,
    flexDirection: 'row',
    padding: 3,
  },
  segmentItem: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 10,
    flex: 1,
    paddingVertical: 11,
  },
  segmentText: { fontSize: 14, fontWeight: '600' },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  person: {
    borderCurve: 'continuous',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  cta: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    paddingVertical: 16,
  },
});
