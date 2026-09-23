import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  formatHouseholdDeletionDate,
  HOUSEHOLD_DELETION_GRACE_DAYS,
} from '@/lib/household/household-deletion';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

type Step = 'overview' | 'confirm_name' | 'confirm_email' | 'done';

export default function DeleteHouseholdScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const {
    accentTheme,
    cancelHouseholdDeletion,
    currentMember,
    currentUser,
    deleteHousehold,
    household,
    householdMemberships,
    switchHousehold,
  } = useOrbit();

  const [step, setStep] = useState<Step>('overview');
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);

  const householdName = household.householdName.trim();
  const accountEmail = (currentUser?.email ?? '').trim().toLowerCase();
  const isOwner = currentMember?.role === 'owner';
  const otherHouseholds = householdMemberships.filter((entry) => entry.householdId !== household.id);

  const nameMatches = useMemo(
    () => nameInput.trim().toLowerCase() === householdName.toLowerCase(),
    [householdName, nameInput]
  );
  const emailMatches = useMemo(
    () => emailInput.trim().toLowerCase() === accountEmail,
    [accountEmail, emailInput]
  );

  const handleScheduleDeletion = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await deleteHousehold();
      setScheduledFor(result.scheduledFor);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule deletion.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOwner) {
    return (
      <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <Text style={[typography.title2, { color: c.text, textAlign: 'center' }]}>
            Owner only
          </Text>
          <Text style={[typography.body, { color: c.textMuted, textAlign: 'center' }]}>
            Only the household owner can delete this household.
          </Text>
          <OrbitButton onPress={() => router.back()}>Go back</OrbitButton>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (step === 'confirm_email') setStep('confirm_name');
            else if (step === 'confirm_name') setStep('overview');
            else router.back();
          }}
          hitSlop={12}
          style={styles.back}>
          <MaterialIcons name="chevron-left" size={22} color={accentTheme.primary} />
          <Text style={[styles.backText, { color: accentTheme.primary }]}>
            {step === 'overview' ? 'Cancel' : 'Back'}
          </Text>
        </Pressable>
      </View>

      <KeyboardScreen
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, space.xl) + space.lg },
        ]}>
        {step === 'overview' ? (
          <Animated.View entering={FadeIn.duration(280)} style={styles.section}>
            <View
              style={[
                styles.warnIcon,
                { backgroundColor: `${c.danger ?? '#F87171'}18`, borderColor: `${c.danger ?? '#F87171'}33` },
              ]}>
              <MaterialIcons name="home-work" size={28} color={c.danger ?? '#F87171'} />
            </View>
            <Text style={[typography.title2, { color: c.text, fontWeight: '700', textAlign: 'center' }]}>
              Delete {householdName}?
            </Text>
            <Text style={[typography.body, styles.leadCenter, { color: c.textMuted }]}>
              Tasks, groceries, rewards, and member access for this household will be removed for
              everyone.
            </Text>
            <View
              style={[
                styles.infoCard,
                { backgroundColor: glass(0.05), borderColor: glassBorder(0.1) },
              ]}>
              <MaterialIcons name="schedule" size={18} color="#FBBF24" />
              <Text style={[typography.footnote, { color: c.text, flex: 1, lineHeight: 20 }]}>
                Your data is kept for {HOUSEHOLD_DELETION_GRACE_DAYS} days in case this was a
                mistake. You can cancel anytime before permanent deletion.
              </Text>
            </View>
            <OrbitButton tone="danger" onPress={() => setStep('confirm_name')}>
              Continue
            </OrbitButton>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.keep}>
              <Text style={[styles.keepText, { color: accentTheme.primary }]}>Keep household</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {step === 'confirm_name' ? (
          <Animated.View entering={FadeIn.duration(280)} style={styles.section}>
            <Text style={[typography.title2, { color: c.text, fontWeight: '700' }]}>
              Type the household name
            </Text>
            <Text style={[typography.body, styles.lead, { color: c.textMuted }]}>
              Confirm you want to delete <Text style={{ fontWeight: '700' }}>{householdName}</Text>.
            </Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setNameInput}
              placeholder={householdName}
              placeholderTextColor={c.textSubtle}
              style={[
                styles.input,
                {
                  backgroundColor: glass(0.04),
                  borderColor: nameMatches ? `${accentTheme.primary}66` : glassBorder(0.1),
                  color: c.text,
                },
              ]}
              value={nameInput}
            />
            <OrbitButton disabled={!nameMatches} tone="danger" onPress={() => setStep('confirm_email')}>
              Continue
            </OrbitButton>
          </Animated.View>
        ) : null}

        {step === 'confirm_email' ? (
          <Animated.View entering={FadeIn.duration(280)} style={styles.section}>
            <Text style={[typography.title2, { color: c.text, fontWeight: '700' }]}>
              Confirm your email
            </Text>
            <Text style={[typography.body, styles.lead, { color: c.textMuted }]}>
              Type the email on your Choremaxx account to schedule deletion.
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmailInput}
              placeholder="you@email.com"
              placeholderTextColor={c.textSubtle}
              style={[
                styles.input,
                {
                  backgroundColor: glass(0.04),
                  borderColor: emailMatches ? `${accentTheme.primary}66` : glassBorder(0.1),
                  color: c.text,
                },
              ]}
              value={emailInput}
            />
            {error ? (
              <Text style={[styles.error, { color: c.danger ?? '#F87171' }]}>{error}</Text>
            ) : null}
            <OrbitButton
              disabled={!emailMatches || busy}
              tone="danger"
              onPress={() => void handleScheduleDeletion()}>
              {busy ? 'Scheduling…' : 'Schedule deletion'}
            </OrbitButton>
          </Animated.View>
        ) : null}

        {step === 'done' ? (
          <Animated.View entering={FadeIn.duration(320)} style={[styles.section, styles.done]}>
            <View
              style={[
                styles.warnIcon,
                { backgroundColor: '#FBBF2418', borderColor: '#FBBF2433' },
              ]}>
              <MaterialIcons name="hourglass-top" size={28} color="#FBBF24" />
            </View>
            <Text style={[typography.title2, { color: c.text, fontWeight: '700', textAlign: 'center' }]}>
              Deletion scheduled
            </Text>
            <Text style={[typography.body, styles.leadCenter, { color: c.textMuted }]}>
              {householdName} will be permanently deleted
              {scheduledFor ? ` on ${formatHouseholdDeletionDate(scheduledFor)}` : ''}. Your data is
              kept for {HOUSEHOLD_DELETION_GRACE_DAYS} days — cancel anytime before then.
            </Text>
            {otherHouseholds.length > 0 ? (
              <OrbitButton
                onPress={() => {
                  void switchHousehold(otherHouseholds[0]!.householdId).then(() => router.replace('/(tabs)'));
                }}>
                Switch to {otherHouseholds[0]!.householdName}
              </OrbitButton>
            ) : null}
            <OrbitButton
              tone="secondary"
              onPress={() => {
                void cancelHouseholdDeletion().then(() => router.back());
              }}>
              Cancel deletion
            </OrbitButton>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.keep}>
              <Text style={[styles.keepText, { color: accentTheme.primary }]}>Done</Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </KeyboardScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: space.md, paddingTop: space.sm },
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 2 },
  backText: { fontSize: 16, fontWeight: '600' },
  content: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.lg },
  section: { gap: space.md },
  lead: { lineHeight: 22, marginBottom: space.sm },
  leadCenter: { lineHeight: 22, marginBottom: space.sm, textAlign: 'center' },
  input: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  infoCard: {
    alignItems: 'flex-start',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
  },
  keep: { alignItems: 'center', paddingVertical: space.sm },
  keepText: { fontSize: 15, fontWeight: '700' },
  warnIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 64,
    justifyContent: 'center',
    marginBottom: space.sm,
    width: 64,
  },
  error: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  done: { alignItems: 'stretch' },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: space.md,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
});
