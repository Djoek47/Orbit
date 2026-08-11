/**
 * Household invite share — AirDrop / Messages / QR.
 * Uses the DB-backed CMX-#### code (not in-memory member tokens).
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { buildInviteLinks } from '@/lib/invites/parse-invite';
import { shareInvite } from '@/lib/invites/share-invite';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function InviteHouseholdScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { household, inviteLinks, refreshInviteLinks, accentTheme } = useOrbit();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const ensureLinks = useCallback(async () => {
    setLoading(true);
    try {
      const links = inviteLinks ?? (await refreshInviteLinks());
      return links;
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
      setStatus('Invite code not ready yet — try again.');
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
      setStatus(
        result === 'shared'
          ? 'Invite shared — AirDrop opens Choremaxx on their iPhone when the app is installed.'
          : 'Share dismissed.'
      );
    } catch {
      setStatus('Could not open the share sheet.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
        <MaterialIcons name="chevron-left" size={22} color={accentTheme.primary} />
        <Text style={[styles.backText, { color: accentTheme.primary }]}>Back</Text>
      </Pressable>

      <Text style={[styles.kicker, { color: accentTheme.secondary }]}>INVITE</Text>
      <Text style={[styles.title, { color: c.text }]}>Share household invite</Text>
      <Text style={[styles.sub, { color: c.textSoft }]}>
        AirDrop to a nearby iPhone, or send via Messages. They open Choremaxx and join with this
        code.
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: c.cardStrong, borderColor: glassBorder(0.1) },
        ]}>
        {loading && !links ? (
          <ActivityIndicator color={accentTheme.primary} />
        ) : (
          <>
            <View style={[styles.qrWrap, { backgroundColor: glass(0.04) }]}>
              {links ? (
                <QRCode value={links.deepLink} size={180} backgroundColor="transparent" color={c.text} />
              ) : null}
            </View>
            <Text style={[styles.codeLabel, { color: c.textMuted }]}>Invite code</Text>
            <Text selectable style={[styles.code, { color: c.text }]}>
              {links?.code ?? '—'}
            </Text>
            <Text selectable style={[styles.link, { color: c.textSubtle }]}>
              {links?.webLink}
            </Text>
          </>
        )}
      </View>

      <OrbitButton disabled={busy || !links} onPress={() => void onShare()}>
        {busy ? 'Opening share…' : 'AirDrop / Share invite'}
      </OrbitButton>
      {status ? <Text style={[styles.status, { color: c.textMuted }]}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, gap: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 4 },
  backText: { fontSize: 15, fontWeight: '700' },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  qrWrap: { padding: 16, borderRadius: 20, marginBottom: 8 },
  codeLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  link: { fontSize: 12, textAlign: 'center' },
  status: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 },
});
