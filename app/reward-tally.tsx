import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitColors, orbitScreen, radius, typography } from '@/constants/orbit-theme';
import { useOrbit } from '@/store/orbit-store';

export default function RewardTallyScreen() {
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    approveRedemption,
    household,
    permissions,
    redemptions,
    rejectRedemption,
  } = useOrbit();

  const sorted = useMemo(
    () =>
      [...(redemptions ?? [])].sort(
        (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
      ),
    [redemptions]
  );

  const pendingCount = sorted.filter((item) => item.status === 'pending').length;
  const approvedCount = sorted.filter((item) => item.status === 'approved').length;

  return (
    <ScrollView
      style={orbitScreen.container}
      contentContainerStyle={[orbitScreen.content, { paddingTop: insets.top + 12 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="chevron-left" size={22} color={accentTheme.primary} />
          <Text style={[styles.backLabel, { color: accentTheme.primary }]}>Back</Text>
        </Pressable>
      </View>

      <View style={orbitScreen.header}>
        <ChoremaxxBadge />
        <Text style={[typography.footnote, { marginTop: 8 }]}>Redeem ledger</Text>
        <Text style={typography.title1}>Reward tally</Text>
        <Text style={typography.body}>
          Pending, approved, and rejected asks — with origin so admins know mint vs special request.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statChip, { borderColor: `${accentTheme.primary}44` }]}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statChip, { borderColor: 'rgba(52,211,153,0.4)' }]}>
          <Text style={[styles.statValue, { color: orbitColors.success }]}>{approvedCount}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={[styles.statChip, { borderColor: 'rgba(255,255,255,0.12)' }]}>
          <Text style={styles.statValue}>{sorted.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {sorted.length === 0 ? (
        <GlassCard>
          <Text style={typography.headline}>No redemptions yet</Text>
          <Text style={typography.footnote}>Redeem from the shop or send a special request.</Text>
        </GlassCard>
      ) : (
        sorted.map((redemption) => {
          const reward = household.rewards.find((item) => item.id === redemption.rewardId);
          const member = household.members.find((item) => item.id === redemption.memberId);
          const origin =
            reward?.origin ?? (reward?.specialRequest ? 'special-request' : 'minted');
          const originLabel = origin === 'special-request' ? 'Special request' : 'Minted';
          return (
            <GlassCard key={redemption.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={typography.headline}>
                  {reward?.emoji ? `${reward.emoji} ` : ''}
                  {reward?.title ?? 'Reward'}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    redemption.status === 'pending' && styles.statusPending,
                    redemption.status === 'approved' && styles.statusApproved,
                    redemption.status === 'rejected' && styles.statusRejected,
                  ]}>
                  <Text style={styles.statusText}>{redemption.status}</Text>
                </View>
              </View>
              <Text style={typography.footnote}>
                {member?.name ?? 'Member'} · {reward?.cost ?? '—'} XP · {originLabel}
                {reward?.createdByName ? ` · by ${reward.createdByName}` : ''}
              </Text>
              <Text style={styles.time}>
                Asked {new Date(redemption.requestedAt).toLocaleString()}
                {redemption.decidedAt
                  ? ` · Decided ${new Date(redemption.decidedAt).toLocaleString()}`
                  : ''}
              </Text>
              {redemption.note ? <Text style={styles.note}>“{redemption.note}”</Text> : null}
              {redemption.status === 'pending' && permissions.canApproveReward ? (
                <View style={styles.actions}>
                  <OrbitButton
                    style={styles.actionBtn}
                    onPress={() => void approveRedemption(redemption.id)}>
                    Approve
                  </OrbitButton>
                  <OrbitButton
                    style={styles.actionBtn}
                    tone="danger"
                    onPress={() => void rejectRedemption(redemption.id)}>
                    Reject
                  </OrbitButton>
                </View>
              ) : null}
            </GlassCard>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  topRow: { marginBottom: 4 },
  backBtn: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 2 },
  backLabel: { fontSize: 15, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.card,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statValue: { color: orbitColors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: orbitColors.textMuted, fontSize: 11, fontWeight: '600' },
  card: { gap: 8 },
  cardHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPending: { backgroundColor: 'rgba(251,191,36,0.18)' },
  statusApproved: { backgroundColor: 'rgba(52,211,153,0.18)' },
  statusRejected: { backgroundColor: 'rgba(248,113,113,0.18)' },
  statusText: {
    color: orbitColors.textSoft,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  time: { color: orbitColors.textSubtle, fontSize: 11 },
  note: { color: orbitColors.textMuted, fontSize: 13, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flex: 1 },
});
