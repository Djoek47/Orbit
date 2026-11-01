/**
 * Choose a new password — where a reset link (or the code from the email) lands.
 *
 * Reached two ways:
 *   • the email's button → /auth/callback?type=recovery → here, already verified
 *   • "Enter the code instead" on Forgot password → here with ?email=…, code first
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/orbit/app-text';
import { AuthErrorBanner } from '@/components/orbit/auth-error-banner';
import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { OrbitInput } from '@/components/orbit/orbit-input';
import { authIssue, resolveAuthIssue, type AuthIssue } from '@/lib/auth/auth-errors';
import {
  checkNewPassword,
  isCompleteResetCode,
  normalizeResetCode,
} from '@/lib/auth/password-reset';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; verified?: string }>();
  const { accentTheme, setNewPassword, verifyPasswordResetCode, orbitPalette } = useOrbit();
  const { c } = useOrbitColors();

  const email = (params.email ?? '').trim();
  // Arriving from the email link, the session is already a recovery one — no code needed.
  const [verified, setVerified] = useState(params.verified === '1' || !email);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<AuthIssue | null>(null);
  const [done, setDone] = useState(false);

  const submitCode = async () => {
    setBusy(true);
    setIssue(null);
    try {
      await verifyPasswordResetCode(email, code);
      setVerified(true);
    } catch (error) {
      setIssue(resolveAuthIssue(error));
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async () => {
    const check = checkNewPassword(password, confirm);
    if (!check.ok) {
      setIssue(authIssue('missing_fields', { message: check.message }));
      return;
    }
    setBusy(true);
    setIssue(null);
    try {
      await setNewPassword(password);
      setDone(true);
    } catch (error) {
      setIssue(resolveAuthIssue(error));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell
        kicker="Account recovery"
        title="Password changed"
        subtitle="Sign in with your new password.">
        <View style={[styles.doneIcon, { backgroundColor: `${c.success}22`, borderColor: `${c.success}44` }]}>
          <MaterialIcons name="check" size={30} color={c.success} />
        </View>
        <OrbitButton onPress={() => router.replace('/sign-in' as never)}>Go to sign in</OrbitButton>
      </AuthShell>
    );
  }

  if (!verified) {
    return (
      <AuthShell
        showBack
        kicker="Account recovery"
        title="Enter your code"
        subtitle={`We sent a 6-digit code to ${email}.`}>
        <OrbitInput
          label="Code"
          value={code}
          onChangeText={(value) => {
            setCode(normalizeResetCode(value));
            if (issue) setIssue(null);
          }}
          keyboardType="number-pad"
          placeholder="123456"
        />
        <AuthErrorBanner issue={issue} onDismiss={() => setIssue(null)} />
        <OrbitButton disabled={busy || !isCompleteResetCode(code)} onPress={() => void submitCode()}>
          {busy ? 'Checking…' : 'Continue'}
        </OrbitButton>
        <Pressable onPress={() => router.replace('/forgot-password' as never)} hitSlop={10}>
          <Text style={[styles.link, { color: accentTheme.primary }]}>Send another email</Text>
        </Pressable>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      showBack
      kicker="Account recovery"
      title="New password"
      subtitle="At least 8 characters. You'll use this to sign in.">
      <OrbitInput
        label="New password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (issue) setIssue(null);
        }}
        secureTextEntry={!show}
        autoCapitalize="none"
        placeholder="••••••••"
      />
      <OrbitInput
        label="Repeat password"
        value={confirm}
        onChangeText={(value) => {
          setConfirm(value);
          if (issue) setIssue(null);
        }}
        secureTextEntry={!show}
        autoCapitalize="none"
        placeholder="••••••••"
      />
      <Pressable onPress={() => setShow((v) => !v)} hitSlop={8} style={styles.showRow}>
        <MaterialIcons
          name={show ? 'visibility-off' : 'visibility'}
          size={16}
          color={orbitPalette.textMuted}
        />
        <Text style={[styles.showLabel, { color: orbitPalette.textMuted }]}>
          {show ? 'Hide passwords' : 'Show passwords'}
        </Text>
      </Pressable>
      <AuthErrorBanner issue={issue} onDismiss={() => setIssue(null)} />
      <OrbitButton disabled={busy || !password || !confirm} onPress={() => void submitPassword()}>
        {busy ? 'Saving…' : 'Save new password'}
      </OrbitButton>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  showRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  showLabel: { fontSize: 13, fontWeight: '600' },
  doneIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
});
