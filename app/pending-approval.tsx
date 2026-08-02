import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors } from '@/constants/orbit-theme';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function PendingApprovalScreen() {
  const { household, refreshHousehold } = useOrbit();
  const { c } = useOrbitColors();
  const [busy, setBusy] = useState(false);

  return (
    <AuthShell
      kicker="Almost there"
      title="Waiting for approval"
      subtitle={`Your request to join ${household.householdName} is pending. An owner or admin needs to approve you before full access unlocks.`}
      footer={
        <Pressable onPress={() => router.push('/settings' as never)} style={styles.secondary}>
          <Text style={[styles.secondaryText, { color: c.textMuted }]}>Open settings</Text>
        </Pressable>
      }>
      <View style={styles.pill}>
        <MaterialIcons name="hourglass-empty" size={14} color={orbitColors.warning} />
        <Text style={styles.pillText}>Pending adult</Text>
      </View>
      <Text style={[styles.cardTitle, { color: c.text }]}>Limited access is active</Text>
      <Text style={[styles.body, { color: c.textSoft }]}>
        You can browse calmly, but creating tasks, groceries, and invites stay locked until approval lands.
      </Text>

      <OrbitButton
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await refreshHousehold();
            router.replace('/' as never);
          } finally {
            setBusy(false);
          }
        }}>
        {busy ? 'Checking…' : 'Check approval status'}
      </OrbitButton>
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
  cardTitle: { fontSize: 16, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20 },
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
