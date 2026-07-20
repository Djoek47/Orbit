import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function PendingApprovalScreen() {
  const { accentTheme, household, refreshHousehold } = useOrbit();
  const [busy, setBusy] = useState(false);

  return (
    <AuthShell
      kicker="Almost there"
      title="Waiting for approval"
      subtitle={`Your request to join ${household.householdName} is pending. An owner or admin needs to approve you before full access unlocks.`}
      footer={
        <Pressable onPress={() => router.push('/settings' as never)} style={styles.secondary}>
          <Text style={styles.secondaryText}>Open settings</Text>
        </Pressable>
      }>
      <View style={styles.pill}>
        <MaterialIcons name="hourglass-empty" size={14} color={orbitColors.warning} />
        <Text style={styles.pillText}>Pending adult</Text>
      </View>
      <Text style={styles.cardTitle}>Limited access is active</Text>
      <Text style={styles.body}>
        You can browse calmly, but creating tasks, groceries, and invites stay locked until approval lands.
      </Text>

      <Pressable
        onPress={async () => {
          setBusy(true);
          try {
            await refreshHousehold();
            router.replace('/' as never);
          } finally {
            setBusy(false);
          }
        }}
        style={styles.ctaWrap}>
        <LinearGradient
          colors={[accentTheme.primary, accentTheme.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cta}>
          <Text style={styles.ctaText}>{busy ? 'Checking…' : 'Check approval status'}</Text>
        </LinearGradient>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(251,146,60,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { color: orbitColors.warning, fontSize: 12, fontWeight: '700' },
  cardTitle: { color: orbitColors.text, fontSize: 16, fontWeight: '800' },
  body: { color: orbitColors.textSoft, fontSize: 14, lineHeight: 20 },
  ctaWrap: { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  cta: { alignItems: 'center', paddingVertical: 15 },
  ctaText: { color: '#070D1C', fontSize: 15, fontWeight: '800' },
  secondary: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 14,
  },
  secondaryText: { color: orbitColors.textMuted, fontSize: 14, fontWeight: '700' },
});
