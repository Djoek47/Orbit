import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { ChoremaxxBadge } from '@/components/orbit/choremaxx-logo';
import { GlassCard } from '@/components/orbit/glass-card';
import { orbitScreen, radius, typography } from '@/constants/orbit-theme';
import {
  formatMoney,
  listAllowanceLedger,
  summarizeAllowanceLedger,
  type AllowanceLedgerEntry,
} from '@/lib/rewards/ledgers';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

export default function AllowanceHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { accentTheme, household } = useOrbit();
  const { c, glass, glassBorder } = useOrbitColors();
  const [entries, setEntries] = useState<AllowanceLedgerEntry[]>([]);

  const reload = useCallback(async () => {
    if (!household.id) {
      setEntries([]);
      return;
    }
    setEntries(await listAllowanceLedger(household.id));
  }, [household.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats = summarizeAllowanceLedger(entries);

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
        <Text style={[typography.footnote, { marginTop: 8, color: c.textMuted }]}>Allowance</Text>
        <Text style={[typography.title1, { color: c.text }]}>Allowance history</Text>
        <Text style={[typography.body, { color: c.textSoft }]}>
          Owed and paid — ChoreMaxx keeps the record; you hand over the money yourselves.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View
          style={[
            styles.statChip,
            { backgroundColor: glass(0.04), borderColor: `${accentTheme.primary}44` },
          ]}>
          <Text style={[styles.statValue, { color: c.text }]}>
            {formatMoney(stats.owed, stats.currency)}
          </Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Owed</Text>
        </View>
        <View
          style={[
            styles.statChip,
            { backgroundColor: glass(0.04), borderColor: 'rgba(52,211,153,0.4)' },
          ]}>
          <Text style={[styles.statValue, { color: c.success }]}>
            {formatMoney(stats.paid, stats.currency)}
          </Text>
          <Text style={[styles.statLabel, { color: c.textMuted }]}>Paid</Text>
        </View>
      </View>

      {entries.length === 0 ? (
        <GlassCard>
          <Text style={[typography.headline, { color: c.text }]}>Nothing here yet.</Text>
          <Text style={[typography.footnote, { color: c.textMuted }]}>
            Allowance marked paid will show up here.
          </Text>
        </GlassCard>
      ) : (
        entries.map((entry) => {
          const member = household.members.find((item) => item.id === entry.memberId);
          return (
            <GlassCard key={entry.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={[typography.headline, { color: c.text }]}>
                  {entry.amountLabel ?? formatMoney(entry.amount, entry.currency)}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    entry.status === 'owed' && styles.statusPending,
                    entry.status === 'paid' && styles.statusApproved,
                  ]}>
                  <Text style={[styles.statusText, { color: c.textSoft }]}>{entry.status}</Text>
                </View>
              </View>
              <Text style={[typography.footnote, { color: c.textMuted }]}>
                {member?.name ?? 'Sidekick'}
                {` · ${entry.periodStart} → ${entry.periodEnd}`}
              </Text>
              <Text style={[styles.time, { color: c.textSubtle }]}>
                {new Date(entry.createdAt).toLocaleString()}
                {entry.markedPaidAt
                  ? ` · Paid ${new Date(entry.markedPaidAt).toLocaleString()}`
                  : ''}
              </Text>
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
  statValue: { fontSize: 18, fontWeight: '800' },
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
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  time: { fontSize: 11 },
});
