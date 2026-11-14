/**
 * Household invite — one calm composition: code, QR, Share.
 * Apple-level restraint: no noise, one primary action.
 */
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AppText as Text } from '@/components/orbit/app-text';
import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { radius, space, typography } from '@/constants/orbit-theme';
import { buildInviteLinks } from '@/lib/invites/parse-invite';
import { shareInvite } from '@/lib/invites/share-invite';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function InviteHouseholdScreen() {
  const { c, glass, glassBorder } = useOrbitColors();
  const { household, inviteLinks, refreshInviteLinks, accentTheme } = useOrbit();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const ensureLinks = useCallback(async () => {
    setLoading(true);
    try {
      return inviteLinks ?? (await refreshInviteLinks());
    } finally {
      setLoading(false);
    }
  }, [inviteLinks, refreshInviteLinks]);

  useEffect(() => {
    void ensureLinks();
  }, [ensureLinks]);

  const code = inviteLinks?.code || household.inviteCode || '';
  const links = code ? buildInviteLinks(code) : null;

  const onShare = async () => {
    if (!links) {
      setStatus('Invite isn’t ready yet.');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const result = await shareInvite({
        householdName: household.householdName,
        inviteCode: links.code,
        deepLink: links.deepLink,
        webLink: links.webLink,
      });
      if (result === 'shared') {
        setStatus('Sent.');
      }
    } catch {
      setStatus('Couldn’t share. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    if (!links) return;
    await Clipboard.setStringAsync(links.code);
    setStatus('Code copied.');
  };

  return (
    <AuthShell
      showBack
      kicker="Household"
      title="Invite"
      subtitle="Share with AirDrop or Messages. They open Choremaxx and join."
      footer={
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={[styles.footerLink, { color: c.textMuted }]}>Done</Text>
        </Pressable>
      }>
      <View
        style={[
          styles.stage,
          {
            backgroundColor: glass(0.04),
            borderColor: glassBorder(0.08),
          },
        ]}>
        {loading && !links ? (
          <ActivityIndicator color={accentTheme.primary} style={styles.loader} />
        ) : (
          <>
            <View style={styles.qrPlate}>
              {links ? (
                <QRCode
                  value={links.deepLink}
                  size={168}
                  backgroundColor="transparent"
                  color={c.text}
                />
              ) : null}
            </View>

            <Pressable onPress={() => void onCopy()} accessibilityLabel="Copy invite code" hitSlop={8}>
              <Text style={[typography.caption1, styles.codeLabel, { color: c.textMuted }]}>
                Code
              </Text>
              <Text selectable style={[styles.code, { color: c.text }]}>
                {links?.code ?? '—'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <OrbitButton disabled={busy || !links} onPress={() => void onShare()}>
        {busy ? 'Sharing…' : 'Share Invite'}
      </OrbitButton>

      {status ? (
        <Text style={[typography.footnote, styles.status, { color: c.textMuted }]}>{status}</Text>
      ) : (
        <Text style={[typography.footnote, styles.status, { color: c.textSubtle }]}>
          Tap the code to copy
        </Text>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.cardLarge,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.md,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
  },
  loader: { marginVertical: space.xxl },
  qrPlate: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
  },
  codeLabel: {
    letterSpacing: 0.6,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  code: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  status: {
    textAlign: 'center',
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
