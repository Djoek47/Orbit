/**
 * Household recovery — owner/admin only, named household with pending purge.
 * Brand-new empty accounts never land here.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { HouseholdRecoveryHourglass } from '@/components/orbit/household-recovery-hourglass';
import { KeyboardScreen } from '@/components/orbit/keyboard-screen';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitAlert } from '@/components/orbit/orbit-alert';
import { radius, space, typography } from '@/constants/orbit-theme';
import { HOUSEHOLD_DELETION_POLICY_COPY } from '@/lib/household/household-deletion';
import { canOpenHouseholdRecovery } from '@/lib/household/household-recovery';
import { leaveModalsToTabs } from '@/lib/navigation/leave-modals-to-tabs';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const TONE = '#FBBF24';

export default function HouseholdRecoveryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ householdId?: string }>();
  const { c, glassBorder, isDark } = useOrbitColors();
  const {
    accentTheme,
    cancelHouseholdDeletion,
    currentMember,
    household,
    householdMemberships,
    optOutHouseholdDeletionReminders,
    requestImmediateHouseholdDeletion,
    switchHousehold,
  } = useOrbit();

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetId = typeof params.householdId === 'string' ? params.householdId : household.id;
  const membership = useMemo(
    () => householdMemberships.find((entry) => entry.householdId === targetId) ?? null,
    [householdMemberships, targetId]
  );

  const activeIsTarget = household.id === targetId;
  const role = activeIsTarget ? currentMember?.role : membership?.role;
  const name = activeIsTarget
    ? household.householdName
    : membership?.householdName ?? '';
  const scheduledFor = activeIsTarget
    ? household.deletionScheduledFor
    : membership?.deletionScheduledFor;

  const eligible = canOpenHouseholdRecovery({
    role,
    householdName: name,
    deletionScheduledFor: scheduledFor,
    hasMembershipHistory: householdMemberships.length > 0 || Boolean(household.id),
  });

  const ensureActiveHousehold = useCallback(async () => {
    if (activeIsTarget || !targetId) return;
    await switchHousehold(targetId);
  }, [activeIsTarget, switchHousehold, targetId]);

  const onCancel = () => {
    if (busy) return;
    orbitAlert(
      'Cancel deletion?',
      `${name} stays. Reminder emails stop and nothing is removed.`,
      [
        { text: 'Keep deleting', style: 'cancel' },
        {
          text: 'Cancel deletion',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            setError(null);
            void (async () => {
              try {
                await ensureActiveHousehold();
                await cancelHouseholdDeletion();
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                leaveModalsToTabs(router);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not cancel deletion.');
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]
    );
  };

  const onDeleteNow = () => {
    if (busy) return;
    orbitAlert(
      'Delete permanently now?',
      'We email a confirmation link. Tap Confirm within 24 hours to finish — or cancel to keep recovering.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Send confirm email',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            setError(null);
            setStatus(null);
            void (async () => {
              try {
                await ensureActiveHousehold();
                await requestImmediateHouseholdDeletion();
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                setStatus('Confirm email sent — check your inbox within 24 hours.');
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : 'Could not start permanent deletion.'
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]
    );
  };

  const onOptOut = () => {
    if (busy) return;
    if (household.deletionRemindersOptOut) {
      setStatus('Reminder emails are already off for this household.');
      return;
    }
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        await ensureActiveHousehold();
        await optOutHouseholdDeletionReminders();
        void Haptics.selectionAsync();
        setStatus('Reminder emails stopped. You can still cancel deletion anytime.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not update email preferences.');
      } finally {
        setBusy(false);
      }
    })();
  };

  if (!eligible || !scheduledFor) {
    return <Redirect href={'/(tabs)' as never} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else leaveModalsToTabs(router);
          }}
          hitSlop={12}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Close recovery">
          <MaterialIcons name="chevron-left" size={22} color={accentTheme.primary} />
          <Text style={[styles.backText, { color: accentTheme.primary }]}>Close</Text>
        </Pressable>
      </View>

      <KeyboardScreen
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, space.xl) + space.lg },
        ]}>
        <HouseholdRecoveryHourglass
          householdName={name}
          scheduledFor={scheduledFor}
          tone={TONE}
        />

        <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.section}>
          <Text style={[typography.title2, { color: c.text, fontWeight: '700', textAlign: 'center' }]}>
            Recover {name}?
          </Text>
          <Text style={[typography.body, styles.lead, { color: c.textMuted }]}>
            {HOUSEHOLD_DELETION_POLICY_COPY.reminderLadder} Cancel anytime before the countdown
            ends.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(140).duration(280)} style={styles.actions}>
          <Text style={[styles.groupLabel, { color: TONE }]}>Actions</Text>

          <OrbitButton disabled={busy} onPress={onCancel}>
            {busy ? 'Working…' : 'Cancel deletion'}
          </OrbitButton>

          <View
            style={[
              styles.actionGroup,
              { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
            ]}>
            <Pressable
              disabled={busy}
              onPress={onOptOut}
              style={({ pressed }) => [
                styles.secondaryRow,
                {
                  opacity: pressed || busy ? 0.75 : 1,
                  borderBottomColor: glassBorder(0.08),
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Stop reminder emails">
              <View style={[styles.rowIcon, { backgroundColor: `${TONE}22` }]}>
                <MaterialIcons name="notifications-off" size={18} color={TONE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.secondaryTitle, { color: c.text }]}>
                  {household.deletionRemindersOptOut
                    ? 'Reminders already off'
                    : 'Stop reminder emails'}
                </Text>
                <Text style={[styles.secondarySub, { color: c.textMuted }]}>
                  Keep the countdown — skip the inbox ladder
                </Text>
              </View>
            </Pressable>
          </View>

          <LinearGradient
            colors={[`${c.danger ?? '#F87171'}22`, `${c.danger ?? '#F87171'}08`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.dangerCard, { borderColor: `${c.danger ?? '#F87171'}44` }]}>
            <Text style={[styles.secondaryTitle, { color: c.text }]}>Delete permanently now</Text>
            <Text style={[styles.secondarySub, { color: c.textMuted, marginBottom: space.sm }]}>
              Shortens to a 24-hour confirm email. Irreversible after you tap Confirm.
            </Text>
            <OrbitButton tone="danger" disabled={busy} onPress={onDeleteNow}>
              Delete permanently now
            </OrbitButton>
          </LinearGradient>
        </Animated.View>

        {status ? (
          <Text style={[styles.status, { color: accentTheme.primary }]}>{status}</Text>
        ) : null}
        {error ? (
          <Text style={[styles.status, { color: c.danger ?? '#F87171' }]}>{error}</Text>
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
  content: {
    flexGrow: 1,
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  section: { gap: space.sm },
  lead: { lineHeight: 22, textAlign: 'center' },
  actions: { gap: space.md },
  groupLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },
  actionGroup: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  secondaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  rowIcon: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  secondaryTitle: { fontSize: 16, fontWeight: '700' },
  secondarySub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  dangerCard: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
    padding: space.md,
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
});
