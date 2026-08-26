import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { OrbitButton } from '@/components/orbit/orbit-button';
import { orbitScreen, radius, typography } from '@/constants/orbit-theme';
import { VOCAB } from '@/constants/vocabulary';
import {
  listRewardLedger,
  summarizeRewardLedger,
  type RewardLedgerEntry,
} from '@/lib/rewards/ledgers';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function RewardTallyScreen() {
  const insets = useSafeAreaInsets();
  const {
    accentTheme,
    approveRedemption,
    household,
    permissions,
    rejectRedemption,
  } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const [entries, setEntries] = useState<RewardLedgerEntry[]>([]);

  const reload = useCallback(async () => {
    if (!household.id) {
      setEntries([]);
      return;
    }
    const rows = await listRewardLedger(household.id);
    setEntries(rows);
  }, [household.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats = summarizeRewardLedger(entries);

  return (
    <ScrollView
      style={[orbitScreen.container, { backgroundColor: c.background }]}
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
        <Text style={[typography.footnote, { marginTop: 8, color: c.textMuted }]}>Rewards</Text>
        <Text style={[typography.title1, { color: c.text }]}>Reward history</Text>
        <Text style={[typography.body, { color: c.textSoft }]}>
          Every reward your family has earned, and what you decided.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View
          style={[
            styles.statChip,
            { backgroundColor: glass(0.04), borderColor: `${accentTheme.primary}44` },
          ]}>
          <Text style={[styles.statValue, { color: c.text }]}>{stats.waiting}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Waiting</Text>
        </View>
        <View
          style={[
            styles.statChip,
            { backgroundColor: glass(0.04), borderColor: 'rgba(52,211,153,0.4)' },
          ]}>
          <Text style={[styles.statValue, { color: c.success }]}>{stats.approved}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Approved</Text>
        </View>
        <View
          style={[
            styles.statChip,
            { backgroundColor: glass(0.04), borderColor: glassBorder(0.12) },
          ]}>
          <Text style={[styles.statValue, { color: c.text }]}>{stats.declined}</Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Declined</Text>
        </View>
      </View>

      {entries.length === 0 ? (
        <GlassCard>
          <Text style={[typography.headline, { color: c.text }]}>Nothing here yet.</Text>
          <Text style={[typography.footnote, { color: c.textMuted }]}>
            Approved rewards will show up here.
          </Text>
        </GlassCard>
      ) : (
        entries.map((entry) => {
          const member = household.members.find((item) => item.id === entry.memberId);
          const originLabel = entry.origin === 'requested' ? VOCAB.askedFor : VOCAB.earned;
          const statusLabel =
            entry.status === 'pending'
              ? 'waiting'
              : entry.status === 'declined'
                ? 'declined'
                : 'approved';
          return (
            <GlassCard key={entry.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={[typography.headline, { color: c.text }]}>{entry.rewardName}</Text>
                <View
                  style={[
                    styles.statusPill,
                    entry.status === 'pending' && styles.statusPending,
                    entry.status === 'approved' && styles.statusApproved,
                    entry.status === 'declined' && styles.statusRejected,
                  ]}>
                  <Text style={[styles.statusText, { color: c.textSoft }]}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={[typography.footnote, { color: c.textMuted }]}>
                {member?.name ?? 'Sidekick'}
                {` · ${originLabel}`}
              </Text>
              <Text style={[styles.time, { color: c.textSubtle }]}>
                {new Date(entry.createdAt).toLocaleString()}
                {entry.resolvedAt
                  ? ` · Decided ${new Date(entry.resolvedAt).toLocaleString()}`
                  : ''}
              </Text>
              {entry.note ? (
                <Text style={[styles.note, { color: c.textMuted }]}>“{entry.note}”</Text>
              ) : null}
              {entry.status === 'pending' && permissions.canApproveReward ? (
                <View style={styles.actions}>
                  <OrbitButton
                    style={styles.actionBtn}
                    onPress={() =>
                      void approveRedemption(entry.id).then(() => reload())
                    }>
                    Approve
                  </OrbitButton>
                  <OrbitButton
                    style={styles.actionBtn}
                    tone="danger"
                    onPress={() =>
                      void rejectRedemption(entry.id).then(() => reload())
                    }>
                    Decline
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
    borderRadius: radius.card,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600' },
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
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  time: { fontSize: 11 },
  note: { fontSize: 13, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flex: 1 },
});
