import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { StatusPill } from '@/components/orbit/status-pill';
import { orbitColors, orbitRadius, orbitScreen, orbitSpacing, orbitTypography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function InviteHouseholdScreen() {
  const { household } = useOrbit();
  const [copied, setCopied] = useState(false);
  const inviteCode = household.inviteCode || 'ORBIT-0000';
  const inviteLink = `https://orbit.local/join/${inviteCode}`;

  const handleCopy = async () => {
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
  };

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={orbitScreen.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={orbitScreen.header}>
        <Text style={orbitTypography.caption}>{household.householdName}</Text>
        <Text style={orbitTypography.display}>Invite members</Text>
        <Text style={orbitTypography.body}>Share this code with people you trust. Approval rules arrive with backend auth.</Text>
      </View>

      <GlassCard elevated style={styles.card}>
        <StatusPill label="Invite code" tone="cyan" />
        <Text selectable style={styles.code}>
          {inviteCode}
        </Text>
        <OrbitButton onPress={handleCopy}>{copied ? 'Copied' : 'Copy Invite Code'}</OrbitButton>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={orbitTypography.cardTitle}>Invite link</Text>
        <Text selectable style={orbitTypography.caption}>
          {inviteLink}
        </Text>
        <OrbitButton tone="secondary" onPress={() => setCopied(true)}>
          Share Link Placeholder
        </OrbitButton>
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={orbitTypography.cardTitle}>QR code</Text>
        <View style={styles.qrPlaceholder}>
          <Text style={styles.qrText}>QR</Text>
        </View>
        <Text style={orbitTypography.caption}>A generated QR code will live here when invite links are real.</Text>
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
  qrPlaceholder: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: orbitColors.border,
    borderRadius: orbitRadius.md,
    borderWidth: 1,
    height: 132,
    justifyContent: 'center',
    width: 132,
  },
  qrText: {
    color: orbitColors.novaCyan,
    fontSize: 28,
    fontWeight: '900',
  },
});
