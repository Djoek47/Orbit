import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors, radius, space } from '@/constants/orbit-theme';
import { buildInviteLinks } from '@/lib/invites/parse-invite';
import { shareInvite } from '@/lib/invites/share-invite';
import { householdRepository } from '@/repositories';
import { useOrbit } from '@/store/orbit-store';
import type { InviteLinks } from '@/types/orbit';

export default function InviteHouseholdScreen() {
  const { household, inviteLinks, permissions, refreshInviteLinks } = useOrbit();
  const [links, setLinks] = useState<InviteLinks | null>(inviteLinks);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [shareStatus, setShareStatus] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (inviteLinks) {
        setLinks(inviteLinks);
        return;
      }
      if (!household.id) {
        return;
      }
      const next = await householdRepository.getInviteLink(household.id);
      if (mounted) {
        setLinks(next);
      }
    }
    load().catch(console.warn);
    return () => {
      mounted = false;
    };
  }, [household.id, inviteLinks]);

  const fallback = buildInviteLinks(links?.code || household.inviteCode || 'CMX-0000');
  const inviteCode = links?.code || fallback.code;
  const deepLink = links?.deepLink || fallback.deepLink;
  const webLink = links?.webLink || fallback.webLink;

  if (!permissions.canInviteMembers) {
    return (
      <AuthShell
        title="Add member locked"
        subtitle="Only owners and admins can add new household members.">
        <Text style={styles.body}>Ask an owner or admin to share an invite from Manage Members.</Text>
      </AuthShell>
    );
  }

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    setCopied('code');
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(webLink);
    setCopied('link');
  };

  const handleAirDropShare = async () => {
    setShareStatus('');
    try {
      const result = await shareInvite({
        householdName: household.householdName,
        inviteCode,
        deepLink,
        webLink,
      });
      setShareStatus(
        result === 'shared'
          ? Platform.OS === 'ios'
            ? 'Shared — use AirDrop, Messages, or Mail from the sheet.'
            : 'Shared via your device share sheet.'
          : 'Share dismissed.',
      );
    } catch {
      setShareStatus('Could not open the share sheet.');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const next =
        (await refreshInviteLinks()) ?? (household.id ? await householdRepository.refreshInvite(household.id) : null);
      if (next) {
        setLinks(next);
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AuthShell
      showBack
      kicker={household.householdName || 'Household'}
      title="Add new member"
      subtitle="Share a code, link, or QR so they can create an account and join. New members wait for owner/admin approval before full access.">
      <View style={styles.qrWrap}>
        <QRCode value={webLink} size={160} backgroundColor="#FFFFFF" color="#070D1C" />
      </View>
      <Text selectable style={styles.code}>
        {inviteCode}
      </Text>
      <OrbitButton onPress={handleAirDropShare}>
        {Platform.OS === 'ios' ? 'AirDrop / Share invite' : 'Share invite'}
      </OrbitButton>
      {shareStatus ? <Text style={styles.hint}>{shareStatus}</Text> : null}
      <OrbitButton onPress={handleCopyCode}>{copied === 'code' ? 'Copied' : 'Copy invite code'}</OrbitButton>
      <OrbitButton tone="secondary" onPress={handleCopyLink}>
        {copied === 'link' ? 'Link copied' : 'Copy web link'}
      </OrbitButton>
      <OrbitButton disabled={refreshing || !household.id} tone="secondary" onPress={handleRefresh}>
        {refreshing ? 'Refreshing…' : 'Refresh code'}
      </OrbitButton>
      <Text selectable style={styles.linkCaption}>
        {webLink}
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  body: {
    color: orbitColors.textSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  code: {
    color: orbitColors.text,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  hint: {
    color: orbitColors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  linkCaption: {
    color: orbitColors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
  },
  qrWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    padding: space.md,
  },
});
