/**
 * Poppins → Actions.
 *
 * Where the month's actions went, day by day, in the same dashboard shape as completed tasks.
 * Buying lives on its own screen now (poppins-credits): an allowance that resets and a balance
 * that never does are two different things, and one page made them look like one.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { CreditBreakdownView } from '@/components/orbit/poppins/credit-breakdown-view';
import { typography } from '@/constants/orbit-theme';
import { loadTokenGrants, topUpBalanceFromGrants } from '@/lib/billing/token-grants';
import { isSidekickRole } from '@/lib/sidekick/permissions';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

const CREDIT_TONE = '#FF9F1C';

function PoppinsActionsScreenInner() {
  const insets = useSafeAreaInsets();
  const { c, glassBorder, isDark } = useOrbitColors();
  const { household, currentMember, permissions, actEvents } = useOrbit();
  const isAdmin = permissions.canManageHousehold;
  const [topUpBalance, setTopUpBalance] = useState(0);

  const readBalance = useCallback(async () => {
    try {
      const grants = await loadTokenGrants(household.id);
      return topUpBalanceFromGrants(grants);
    } catch (error) {
      console.warn('poppins-actions balance', error);
      return null;
    }
  }, [household.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const balance = await readBalance();
      if (balance != null && !cancelled) setTopUpBalance(balance);
    })();
    return () => {
      cancelled = true;
    };
  }, [readBalance]);

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top + 8 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <MaterialIcons name="chevron-left" size={28} color={c.text} />
        </Pressable>
        <Text style={[typography.headline, { color: c.text }]}>Actions</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}>
        <CreditBreakdownView
          events={actEvents}
          onlyMemberName={isAdmin ? null : currentMember?.name ?? null}
          topUpBalance={topUpBalance}
          isAdmin={isAdmin}
        />

        {isAdmin ? (
          <Pressable
            onPress={() => router.push('/poppins-credits' as never)}
            accessibilityRole="button"
            accessibilityLabel="Credits"
            style={({ pressed }) => [
              styles.link,
              {
                backgroundColor: glassFill(isDark),
                borderColor: glassBorder(0.1),
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <View style={[styles.linkMoji, { backgroundColor: `${CREDIT_TONE}22` }]}>
              <Moji name="moneyBag" size={16} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[styles.linkTitle, { color: c.text }]}>Credits</Text>
              <Text style={[styles.linkSub, { color: c.textMuted }]}>
                {topUpBalance > 0
                  ? `${topUpBalance} banked · never expire`
                  : 'Buy actions that never expire'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={c.textSubtle} />
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  content: { gap: 18, paddingHorizontal: 16, paddingTop: 8 },
  link: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  linkMoji: {
    alignItems: 'center',
    borderRadius: 11,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  linkTitle: { fontSize: 15.5, fontWeight: '700' },
  linkSub: { fontSize: 12.5 },
});

/** Sidekicks never get Poppins — any way in (a link, a notification, a stale tab) lands on Home. */
export default function PoppinsActionsScreen() {
  const { currentMember } = useOrbit();
  if (isSidekickRole(currentMember?.role)) {
    return <Redirect href={'/(tabs)' as never} />;
  }
  return <PoppinsActionsScreenInner />;
}
