import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/orbit/auth-shell';
import { orbitColors } from '@/constants/orbit-theme';
import { hrefAfterJoinApproval } from '@/lib/invites/join-session';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import { resetToGetStarted } from '@/lib/navigation/reset-to-get-started';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { AppText as Text } from '@/components/orbit/app-text';

const POLL_MS = 4000;

export default function PendingApprovalScreen() {
  const { household, checkJoinApproval, signOut, currentMember, currentUser } = useOrbit();
  const { c } = useOrbitColors();
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isSidekickRole(currentMember?.role)) {
      router.replace('/' as never);
    }
  }, [currentMember?.role]);

  const tryAdvance = useCallback(async () => {
    const status = await checkJoinApproval();
    if (status === 'approved') {
      const next = hrefAfterJoinApproval({
        needsDisplayName: false,
        previousAccountName: currentUser?.name,
        memberDisplayName: currentMember?.name,
      });
      router.replace(next as never);
      return true;
    }
    if (status === 'missing') {
      setNote('This join request is no longer on file. Ask an admin to send a new invite.');
    }
    return false;
  }, [checkJoinApproval, currentMember?.name, currentUser?.name]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let timer: ReturnType<typeof setInterval> | null = null;

      const poll = () => {
        void tryAdvance().then((done) => {
          if (done || cancelled) return;
        });
      };

      poll();
      timer = setInterval(poll, POLL_MS);

      return () => {
        cancelled = true;
        if (timer) clearInterval(timer);
      };
    }, [tryAdvance])
  );

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
        <Pressable
          onPress={() =>
            void signOut()
              .catch((error) => console.warn('pending.signOut', error))
              .finally(() => resetToGetStarted())
          }
          style={styles.secondary}>
          <Text style={[styles.secondaryText, { color: c.textMuted }]}>Use a different account</Text>
        </Pressable>
      }>
      <View style={styles.pill}>
        <MaterialIcons name="hourglass-empty" size={14} color={orbitColors.warning} />
        <Text style={styles.pillText}>
          {currentMember?.role === 'child' ? 'Pending profile' : 'Pending adult'}
        </Text>
      </View>
      <Text style={[styles.cardTitle, { color: c.text }]}>Limited access is active</Text>
      <Text style={[styles.body, { color: c.textSoft }]}>
        You can browse calmly, but creating tasks, groceries, and invites stay locked until approval
        lands. This screen updates automatically when an admin approves you.
      </Text>
      {note ? <Text style={[styles.body, { color: c.textMuted }]}>{note}</Text> : null}
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
