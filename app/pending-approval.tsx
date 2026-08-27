import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors } from '@/constants/orbit-theme';
import { stillWaitingCopy } from '@/lib/invites/invite-intent';
import { hrefAfterJoinApproval } from '@/lib/invites/join-session';
import { resetToGetStarted } from '@/lib/navigation/reset-to-get-started';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

export default function PendingApprovalScreen() {
  const { household, checkJoinApproval, signOut, currentMember, currentUser } = useOrbit();
  const { c } = useOrbitColors();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  return (
    <AuthShell
      showBack
      onBack={() => {
        void signOut()
          .catch((error) => console.warn('pending.signOut', error))
          .finally(() => resetToGetStarted());
      }}
      kicker="Almost there"
      title="Waiting for approval"
      subtitle={
        currentMember?.role === 'child'
          ? `${household.householdName} will let you in once an admin approves your profile.`
          : `Your request to join ${household.householdName} is pending. An owner or admin needs to approve you before full access unlocks.`
      }
      footer={
        <View style={styles.footerStack}>
          <Pressable onPress={() => router.push('/settings' as never)} style={styles.secondary}>
            <Text style={[styles.secondaryText, { color: c.textMuted }]}>Open settings</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              void signOut()
                .catch((error) => console.warn('pending.signOut', error))
                .finally(() => resetToGetStarted())
            }
            style={styles.secondary}>
            <Text style={[styles.secondaryText, { color: c.textMuted }]}>Use a different account</Text>
          </Pressable>
        </View>
      }>
      <View style={styles.pill}>
        <MaterialIcons name="hourglass-empty" size={14} color={orbitColors.warning} />
        <Text style={styles.pillText}>Pending adult</Text>
      </View>
      <Text style={[styles.cardTitle, { color: c.text }]}>Limited access is active</Text>
      <Text style={[styles.body, { color: c.textSoft }]}>
        You can browse calmly, but creating tasks, groceries, and invites stay locked until approval lands.
      </Text>
      {note ? (
        <Text style={[styles.body, { color: c.textMuted }]}>{note}</Text>
      ) : null}

      <OrbitButton
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            const status = await checkJoinApproval();
            if (status === 'approved') {
              const next = hrefAfterJoinApproval({
                needsDisplayName: false,
                previousAccountName: currentUser?.name,
                memberDisplayName: currentMember?.name,
              });
              router.replace(next as never);
              return;
            }
            if (status === 'missing') {
              setNote('This join request is no longer on file. Ask an admin to send a new invite.');
              return;
            }
            setNote(stillWaitingCopy(household.householdName));
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
  footerStack: { gap: 10 },
});
