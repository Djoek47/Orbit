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
import { resetToGetStarted } from '@/lib/navigation/reset-to-get-started';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

type Step = 'reason' | 'confirm' | 'done';

const REASONS = [
  { id: 'not_using', label: 'I don’t use it enough' },
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'privacy', label: 'Privacy concerns' },
  { id: 'switching', label: 'Switching to another app' },
  { id: 'other', label: 'Something else' },
] as const;

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { accentTheme, deleteAccount } = useOrbit();
  const [step, setStep] = useState<Step>('reason');
  const [reasonId, setReasonId] = useState<(typeof REASONS)[number]['id'] | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reasonLabel = useMemo(
    () => REASONS.find((r) => r.id === reasonId)?.label ?? '',
    [reasonId]
  );

  const handleDelete = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteAccount(
        reasonId
          ? {
              reason: reasonLabel,
              detail: detail.trim() || undefined,
            }
          : undefined
      );
      setStep('done');
      await new Promise((r) => setTimeout(r, 900));
      resetToGetStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable
          onPress={() => (step === 'confirm' ? setStep('reason') : router.back())}
          hitSlop={12}
          style={styles.back}>
          <MaterialIcons name="chevron-left" size={22} color={accentTheme.primary} />
          <Text style={[styles.backText, { color: accentTheme.primary }]}>
            {step === 'confirm' ? 'Back' : 'Cancel'}
          </Text>
        </Pressable>
      </View>

      <KeyboardScreen
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, space.xl) + space.lg },
        ]}>
        {step === 'reason' ? (
          <Animated.View entering={FadeIn.duration(280)} style={styles.section}>
            <Text style={[typography.title2, { color: c.text, fontWeight: '700' }]}>
              Delete account
            </Text>
            <Text style={[typography.body, styles.lead, { color: c.textMuted }]}>
              This removes your profile and personal account data. Household-shared content may
              remain for other members.
            </Text>

            <Text style={[styles.sectionLabel, { color: c.textSoft }]}>
              Optional — why are you leaving?
            </Text>

            <View style={styles.reasons}>
              {REASONS.map((reason, index) => {
                const selected = reasonId === reason.id;
                return (
                  <Animated.View key={reason.id} entering={FadeInUp.delay(40 * index).duration(240)}>
                    <Pressable
                      onPress={() => setReasonId(reason.id)}
                      style={[
                        styles.reasonRow,
                        {
                          backgroundColor: selected ? `${accentTheme.primary}18` : glass(0.04),
                          borderColor: selected ? `${accentTheme.primary}55` : glassBorder(0.08),
                        },
                      ]}>
                      <View
                        style={[
                          styles.radio,
                          {
                            borderColor: selected ? accentTheme.primary : glassBorder(0.2),
                            backgroundColor: selected ? accentTheme.primary : 'transparent',
                          },
                        ]}
                      />
                      <Text style={[styles.reasonLabel, { color: c.text }]}>{reason.label}</Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            {reasonId ? (
              <Animated.View entering={FadeInUp.duration(220)} style={styles.detailBlock}>
                <Text style={[styles.sectionLabel, { color: c.textSoft }]}>
                  Anything else? (optional)
                </Text>
                <TextInput
                  multiline
                  maxLength={500}
                  onChangeText={setDetail}
                  placeholder="A short note helps us improve."
                  placeholderTextColor={c.textSubtle}
                  style={[
                    styles.detailInput,
                    {
                      backgroundColor: glass(0.04),
                      borderColor: glassBorder(0.1),
                      color: c.text,
                    },
                  ]}
                  value={detail}
                />
              </Animated.View>
            ) : null}

            <OrbitButton onPress={() => setStep('confirm')} tone={reasonId ? 'danger' : 'secondary'}>
              Continue
            </OrbitButton>

            {!reasonId ? (
              <Text style={[styles.skipHint, { color: c.textSubtle }]}>
                Feedback is optional — you can continue without selecting a reason.
              </Text>
            ) : null}

            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.keep}>
              <Text style={[styles.keepText, { color: accentTheme.primary }]}>Keep my account</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {step === 'confirm' ? (
          <Animated.View entering={FadeIn.duration(280)} style={styles.section}>
            <View
              style={[
                styles.warnIcon,
                { backgroundColor: `${c.danger ?? '#F87171'}18`, borderColor: `${c.danger ?? '#F87171'}33` },
              ]}>
              <MaterialIcons name="warning-amber" size={28} color={c.danger ?? '#F87171'} />
            </View>
            <Text style={[typography.title2, { color: c.text, fontWeight: '700', textAlign: 'center' }]}>
              Delete forever?
            </Text>
            <Text style={[typography.body, styles.leadCenter, { color: c.textMuted }]}>
              This cannot be undone. You’ll need a new account to use Choremaxx again.
            </Text>

            {error ? (
              <Text style={[styles.error, { color: c.danger ?? '#F87171' }]}>{error}</Text>
            ) : null}

            <OrbitButton disabled={busy} onPress={() => void handleDelete()} tone="danger">
              {busy ? 'Deleting…' : 'Delete my account'}
            </OrbitButton>

            <Pressable
              disabled={busy}
              onPress={() => setStep('reason')}
              hitSlop={12}
              style={styles.keep}>
              <Text style={[styles.keepText, { color: accentTheme.primary }]}>Go back</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        {step === 'done' ? (
          <Animated.View entering={FadeIn.duration(320)} style={[styles.section, styles.done]}>
            <View
              style={[
                styles.warnIcon,
                { backgroundColor: `${c.success}22`, borderColor: `${c.success}44` },
              ]}>
              <MaterialIcons name="check" size={28} color={c.success} />
            </View>
            <Text style={[typography.title2, { color: c.text, fontWeight: '700', textAlign: 'center' }]}>
              Account deleted
            </Text>
            <Text style={[typography.body, styles.leadCenter, { color: c.textMuted }]}>
              Thank you for trying Choremaxx.
            </Text>
          </Animated.View>
        ) : null}
      </KeyboardScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  back: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 2,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
  section: {
    gap: space.md,
  },
  lead: {
    lineHeight: 22,
    marginBottom: space.sm,
  },
  leadCenter: {
    lineHeight: 22,
    marginBottom: space.sm,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: space.xs,
  },
  reasons: {
    gap: space.sm,
  },
  reasonRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  radio: {
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 2,
    height: 18,
    width: 18,
  },
  reasonLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  detailBlock: {
    gap: space.xs,
  },
  detailInput: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 96,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    textAlignVertical: 'top',
  },
  keep: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  keepText: {
    fontSize: 15,
    fontWeight: '700',
  },
  skipHint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
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
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  done: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
  },
});
