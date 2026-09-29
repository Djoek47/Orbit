import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthErrorBanner } from '@/components/orbit/auth-error-banner';
import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { orbitColors } from '@/constants/orbit-theme';
import { authIssue, resolveAuthIssue, type AuthIssue } from '@/lib/auth/auth-errors';
import {
  latestMockResetEmail,
  resendLabel,
  resetResendRemainingMs,
} from '@/lib/auth/password-reset';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

export default function ForgotPasswordScreen() {
  const { accentTheme, forgotPassword, orbitPalette } = useOrbit();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [issue, setIssue] = useState<AuthIssue | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Tick the Resend countdown while it's running.
  useEffect(() => {
    if (!sentTo) return;
    const tick = () => setCooldown(resetResendRemainingMs());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [sentTo]);

  const handleReset = async () => {
    if (!email.trim()) {
      setIssue(authIssue('missing_fields', { message: 'Enter the email for your Choremaxx account.' }));
      setMessage('');
      return;
    }
    setSending(true);
    setIssue(null);
    setMessage('');
    try {
      await forgotPassword(email);
      setSentTo(email.trim());
      const mock = latestMockResetEmail(email);
      setMessage(
        mock
          ? `Test mode: your code is ${mock.code}. Tap "Enter the code instead".`
          : 'If this email is on file, a reset link is on its way. Check your inbox and spam folder.'
      );
    } catch (error) {
      setIssue(resolveAuthIssue(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell
      showBack
      kicker="Account recovery"
      title="Reset password"
      subtitle="Enter your Choremaxx email for a reset link."
      footer={
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.secondary,
            {
              backgroundColor: orbitPalette.card,
              borderColor: orbitPalette.border,
            },
          ]}>
          <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>
            Back to sign in
          </Text>
        </Pressable>
      }>
      <OrbitInput
        autoCapitalize="none"
        label="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (issue) setIssue(null);
        }}
        keyboardType="email-address"
        placeholder="you@home.com"
      />
      <AuthErrorBanner issue={issue} onDismiss={() => setIssue(null)} />
      {message ? (
        <Text style={[styles.message, { color: orbitPalette.success }]}>{message}</Text>
      ) : null}
      <OrbitButton
        disabled={sending || !email.trim() || (Boolean(sentTo) && cooldown > 0)}
        onPress={() => void handleReset()}>
        {sending ? 'Sending…' : sentTo ? resendLabel() : 'Send reset link'}
      </OrbitButton>

      {sentTo ? (
        <View style={styles.afterSend}>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/reset-password', params: { email: sentTo } } as never)
            }
            hitSlop={10}>
            <Text style={[styles.secondaryText, { color: accentTheme.primary }]}>
              Enter the code instead
            </Text>
          </Pressable>
          <Text style={[styles.hint, { color: orbitPalette.textMuted }]}>
            The email has a button and a 6-digit code. Either one works.
          </Text>
        </View>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  afterSend: { alignItems: 'center', gap: 6 },
  hint: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  message: { color: orbitColors.success, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  secondary: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 14,
  },
  secondaryText: { fontSize: 14, fontWeight: '700' },
});
