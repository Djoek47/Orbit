import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { householdRepository } from '@/repositories';
import { useOrbit } from '@/store/orbit-store';
import type { InviteLinks } from '@/types/orbit';

export default function InviteHouseholdScreen() {
  const { household, inviteLinks, permissions, refreshInviteLinks } = useOrbit();
  const [links, setLinks] = useState<InviteLinks | null>(inviteLinks);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
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

  const inviteCode = links?.code || household.inviteCode || 'ORBIT-0000';
  const deepLink = links?.deepLink || `orbit://join/${inviteCode}`;
  const webLink = links?.webLink || `https://orbit.app/join/${inviteCode}`;

  if (!permissions.canInviteMembers) {
    return (
      <ScrollView style={orbitScreen.container} contentContainerStyle={orbitScreen.content}>
        <Text style={orbitTypography.title}>Invites locked</Text>
        <Text style={orbitTypography.body}>Only owners and admins can invite new household members.</Text>
      </ScrollView>
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
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>{household.householdName}</Text>
        <Text style={orbitTypography.display}>Invite members</Text>
        <Text style={orbitTypography.body}>
          Share the QR code or invite code. New members wait for owner/admin approval before full access.
        </Text>
      </View>

      <GlassCard elevated style={styles.card}>
        <StatusPill label="Scan to join" tone="cyan" />
        <View style={styles.qrWrap}>
          <QRCode value={webLink} size={180} backgroundColor="#FFFFFF" color="#070B14" />
        </View>
        <Text style={orbitTypography.caption}>Encodes {webLink}</Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <StatusPill label="Invite code" tone="blue" />
        <Text selectable style={styles.code}>
          {inviteCode}
        </Text>
        <OrbitButton onPress={handleCopyCode}>{copied === 'code' ? 'Copied' : 'Copy Invite Code'}</OrbitButton>
        <OrbitButton disabled={refreshing || !household.id} tone="secondary" onPress={handleRefresh}>
          {refreshing ? 'Refreshing…' : 'Refresh code'}
        </OrbitButton>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={orbitTypography.cardTitle}>Invite links</Text>
        <Text selectable style={orbitTypography.caption}>
          {webLink}
        </Text>
        <Text selectable style={orbitTypography.caption}>
          {deepLink}
        </Text>
        <OrbitButton tone="secondary" onPress={handleCopyLink}>
          {copied === 'link' ? 'Link copied' : 'Copy web link'}
        </OrbitButton>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: orbitSpacing.md,
  },
  code: {
    color: orbitColors.text,
    fontSize: 34,
    fontVariant: ['tabular-nums'],
    fontWeight: '900',
    letterSpacing: 0,
  },
  qrWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: orbitRadius.md,
    padding: orbitSpacing.md,
  },
});
