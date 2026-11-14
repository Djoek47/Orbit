import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text, AppTextInput as TextInput } from '@/components/orbit/app-text';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { SettingsGroup, SettingsNavRow } from '@/components/orbit/settings/grouped';
import { radius, space, typography } from '@/constants/orbit-theme';
import {
  canManageHouseholdDeletion,
  formatHouseholdDeletionDate,
  HOUSEHOLD_DELETION_POLICY_COPY,
} from '@/lib/household/household-deletion';
import { leaveModalsToTabs } from '@/lib/navigation/leave-modals-to-tabs';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

type Step = 'overview' | 'confirm_name' | 'confirm_email' | 'done';

const DANGER = '#F87171';
const AMBER = '#FBBF24';

export default function DeleteHouseholdScreen() {
  const insets = useSafeAreaInsets();
  const { c, glassBorder, isDark } = useOrbitColors();
  const {
    accentTheme,
    cancelHouseholdDeletion,
    currentMember,
    currentUser,
    deleteHousehold,
    household,
    householdMemberships,
    requestImmediateHouseholdDeletion,
    switchHousehold,
  } = useOrbit();

  const [step, setStep] = useState<Step>('overview');
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [immediateNote, setImmediateNote] = useState<string | null>(null);

  const householdName = household.householdName.trim();
  const accountEmail = (currentUser?.email ?? '').trim().toLowerCase();
  const canManage = canManageHouseholdDeletion(currentMember?.role);
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

  if (!canManage) {
    return (
      <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: glassFill(isDark), borderColor: `${DANGER}44` },
            ]}>
            <Text style={[typography.title2, { color: c.text, textAlign: 'center' }]}>
              Admin only
            </Text>
            <Text style={[typography.body, { color: c.textMuted, textAlign: 'center', lineHeight: 22 }]}>
              Only a household owner or admin can delete this household.
            </Text>
            <OrbitButton onPress={() => router.back()}>Go back</OrbitButton>
          </View>
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
            else if (step === 'done') leaveModalsToTabs(router);
            else router.back();
          }}
          hitSlop={12}
          style={styles.back}>
          <MaterialIcons name="chevron-left" size={22} color={accentTheme.primary} />
          <Text style={[styles.backText, { color: accentTheme.primary }]}>
            {step === 'overview' ? 'Cancel' : step === 'done' ? 'Done' : 'Back'}
          </Text>
        </Pressable>
      </View>

      <KeyboardScreen
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, space.xl) + space.lg },
        ]}>
        {step === 'overview' ? (
          <Animated.View entering={FadeInDown.duration(260)} style={styles.section}>
            <LinearGradient
              colors={[`${DANGER}3D`, `${DANGER}0F`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.hero, { borderColor: `${DANGER}55` }]}>
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <Text style={[styles.heroEyebrow, { color: DANGER }]}>Delete</Text>
                <Text style={[styles.heroTitle, { color: c.text }]} numberOfLines={2}>
                  {householdName}
                </Text>
                <Text style={[styles.heroSub, { color: c.textMuted }]}>
                  Tasks, groceries, rewards, and member access leave for everyone.
                </Text>
                <Text style={[styles.heroSub, { color: c.textSubtle }]}>
                  {HOUSEHOLD_DELETION_POLICY_COPY.overview}
                </Text>
              </View>
              <View style={[styles.heroMoji, { backgroundColor: `${DANGER}2E` }]}>
                <MaterialIcons name="home-work" size={32} color={DANGER} />
              </View>
            </LinearGradient>

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
            <Text style={[styles.groupLabel, { color: DANGER }]}>Confirm</Text>
            <View
              style={[
                styles.confirmCard,
                { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
              ]}>
              <Text style={[typography.title2, { color: c.text, fontWeight: '700' }]}>
                Type the household name
              </Text>
              <Text style={[typography.body, styles.lead, { color: c.textMuted }]}>
                Confirm you want to delete{' '}
                <Text style={{ fontWeight: '700', color: c.text }}>{householdName}</Text>.
              </Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={setNameInput}
                placeholder={householdName}
                placeholderTextColor={c.textSubtle}
                style={[
                  styles.input,
                  {
                    backgroundColor: glassFill(isDark, 0.04),
                    borderColor: nameMatches ? `${accentTheme.primary}66` : glassBorder(0.1),
                    color: c.text,
                  },
                ]}
                value={nameInput}
              />
            </View>
            <OrbitButton disabled={!nameMatches} tone="danger" onPress={() => setStep('confirm_email')}>
              Continue
            </OrbitButton>
          </Animated.View>
        ) : null}

        {step === 'confirm_email' ? (
          <Animated.View entering={FadeIn.duration(280)} style={styles.section}>
            <Text style={[styles.groupLabel, { color: DANGER }]}>Confirm</Text>
            <View
              style={[
                styles.confirmCard,
                { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
              ]}>
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
                    backgroundColor: glassFill(isDark, 0.04),
                    borderColor: emailMatches ? `${accentTheme.primary}66` : glassBorder(0.1),
                    color: c.text,
                  },
                ]}
                value={emailInput}
              />
              {error ? (
                <Text style={[styles.error, { color: DANGER }]}>{error}</Text>
              ) : null}
            </View>
            <OrbitButton
              disabled={!emailMatches || busy}
              tone="danger"
              onPress={() => void handleScheduleDeletion()}>
              {busy ? 'Scheduling…' : 'Schedule deletion'}
            </OrbitButton>
          </Animated.View>
        ) : null}

        {step === 'done' ? (
          <Animated.View entering={FadeInDown.duration(280)} style={styles.section}>
            <LinearGradient
              colors={[`${AMBER}3D`, `${AMBER}0F`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.hero, { borderColor: `${AMBER}55` }]}>
              <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                <Text style={[styles.heroEyebrow, { color: AMBER }]}>Scheduled</Text>
                <Text style={[styles.heroTitle, { color: c.text }]} numberOfLines={2}>
                  {householdName}
                </Text>
                <Text style={[styles.heroSub, { color: c.textMuted }]}>
                  Permanently deleted
                  {scheduledFor ? ` on ${formatHouseholdDeletionDate(scheduledFor)}` : ''}.{' '}
                  {HOUSEHOLD_DELETION_POLICY_COPY.scheduled}
                </Text>
                {immediateNote ? (
                  <Text style={[styles.heroSub, { color: accentTheme.primary }]}>{immediateNote}</Text>
                ) : null}
              </View>
              <View style={[styles.heroMoji, { backgroundColor: `${AMBER}2E` }]}>
                <MaterialIcons name="hourglass-top" size={32} color={AMBER} />
              </View>
            </LinearGradient>

            {otherHouseholds.length > 0 ? (
              <OrbitButton
                onPress={() => {
                  void switchHousehold(otherHouseholds[0]!.householdId)
                    .then(() => {
                      leaveModalsToTabs(router);
                    })
                    .catch((err) => {
                      setError(err instanceof Error ? err.message : 'Could not switch household.');
                    });
                }}>
                Switch to {otherHouseholds[0]!.householdName}
              </OrbitButton>
            ) : (
              <OrbitButton
                onPress={() => {
                  void cancelHouseholdDeletion().then(() => router.back());
                }}>
                Cancel deletion
              </OrbitButton>
            )}

            <SettingsGroup header="More">
              {otherHouseholds.length > 0 ? (
                <SettingsNavRow
                  icon="undo"
                  iconColor={AMBER}
                  label="Cancel deletion"
                  subtitle="Keep this household"
                  onPress={() => {
                    void cancelHouseholdDeletion().then(() => router.back());
                  }}
                />
              ) : null}
              <SettingsNavRow
                icon="hourglass-top"
                iconColor={AMBER}
                label="Open recovery countdown"
                subtitle="Live timer until permanent delete"
                onPress={() => router.push('/household-recovery' as never)}
              />
              <SettingsNavRow
                icon="warning"
                iconColor={DANGER}
                label={busy ? 'Sending…' : 'Delete sooner'}
                subtitle="24-hour confirm email"
                last
                onPress={() => {
                  if (busy) return;
                  setBusy(true);
                  setImmediateNote(null);
                  void requestImmediateHouseholdDeletion()
                    .then((result) => {
                      setScheduledFor(result.scheduledFor);
                      setImmediateNote(
                        'Confirm email sent — tap Confirm in your inbox within 24 hours to finish permanent deletion.'
                      );
                    })
                    .catch((err) => {
                      setError(
                        err instanceof Error ? err.message : 'Could not accelerate deletion.'
                      );
                    })
                    .finally(() => setBusy(false));
                }}
              />
            </SettingsGroup>

            {error ? <Text style={[styles.error, { color: DANGER }]}>{error}</Text> : null}

            <Pressable onPress={() => leaveModalsToTabs(router)} hitSlop={12} style={styles.keep}>
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
  groupLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },
  hero: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  heroSub: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  heroMoji: {
    alignItems: 'center',
    borderRadius: 24,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  confirmCard: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    gap: space.sm,
    padding: space.md,
  },
  input: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  keep: { alignItems: 'center', paddingVertical: space.sm },
  keepText: { fontSize: 15, fontWeight: '700' },
  error: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  emptyCard: {
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: 1,
    gap: space.md,
    padding: space.lg,
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    gap: space.md,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
});
