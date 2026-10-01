/**
 * Poppins → Credits.
 *
 * Credits are not the monthly allowance, and this screen exists so the two stop looking alike:
 *
 *   the allowance  300 actions, back on the 1st, gone if unused
 *   credits        bought, banked, and never expiring — they carry month to month and are only
 *                  drawn on once the allowance is spent
 *
 * Where the month went is its own screen (poppins-actions).
 *
 * Buying is mocked on purpose. No payment system is connected yet, so a purchase mints a
 * transaction, grants the tokens through the real grant path, and writes a receipt you can
 * open — enough to walk the whole flow and see the balance move. Every receipt says plainly
 * that no card was charged.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { typography } from '@/constants/orbit-theme';
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import {
  formatResetDate,
  spendsFrom,
  summarizeCredits,
  type CreditSummary,
} from '@/lib/billing/credit-ledger';
import { grantTokenPack, loadTokenGrants } from '@/lib/billing/token-grants';
import { summarizeActUsage } from '@/lib/ai/act-events';
import {
  buildTopUpReceipt,
  fileReceipt,
  formatPerAction,
  formatPrice,
  receiptBody,
  receiptInbox,
  receiptLine,
  topUpPacks,
  type TopUpPack,
  type TopUpReceipt,
} from '@/lib/billing/topup-receipt';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { isSidekickRole } from '@/lib/sidekick/permissions';

const TOPUP_TONE = '#FF9F1C';

function PoppinsCreditsScreenInner() {
  const insets = useSafeAreaInsets();
  const { c, glassBorder, isDark } = useOrbitColors();
  const { household, permissions, actEvents } = useOrbit();
  const isAdmin = permissions.canManageHousehold;

  const monthUsed = useMemo(() => summarizeActUsage(actEvents).tokensUsedThisPeriod, [actEvents]);
  const [credits, setCredits] = useState<CreditSummary>(() => summarizeCredits([], monthUsed));
  const topUpBalance = credits.balance;
  const [receipts, setReceipts] = useState<TopUpReceipt[]>(() => receiptInbox());
  const [buying, setBuying] = useState<string | null>(null);
  const [openReceipt, setOpenReceipt] = useState<TopUpReceipt | null>(null);
  // Where a receipt would be sent. Mock mode has no signed-in address, so the receipt says so.
  const [billingEmail, setBillingEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { getSupabaseClient } = await import('@/lib/supabase/client');
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        const email = data.session?.user?.email;
        if (email && !cancelled) setBillingEmail(email);
      } catch {
        /* mock mode — the placeholder below is used instead */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reads the grants ledger; the caller decides what to do with it.
  const readBalance = useCallback(async () => {
    try {
      const grants = await loadTokenGrants(household.id);
      return summarizeCredits(grants, monthUsed);
    } catch (error) {
      console.warn('poppins-credits balance', error);
      return null;
    }
  }, [household.id, monthUsed]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await readBalance();
      if (next && !cancelled) setCredits(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [readBalance]);

  const packs = useMemo(() => topUpPacks(), []);

  const buy = useCallback(
    (pack: TopUpPack) => {
      Alert.alert(
        `${pack.label} · ${formatPrice(pack.priceUsd)}`,
        'This is a test purchase. No card is charged and no money moves — the actions and the receipt are real so the whole flow can be checked.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Buy (test)',
            onPress: () => {
              setBuying(pack.key);
              void (async () => {
                try {
                  const receipt = buildTopUpReceipt({
                    packKey: pack.key,
                    to: billingEmail || 'this device (no email on file)',
                    householdName: household.householdName,
                  });
                  if (!household.id) throw new Error('no household yet');
                  await grantTokenPack({
                    householdId: household.id,
                    packKey: pack.key,
                    transactionId: receipt.transactionId,
                    mock: true,
                  });
                  fileReceipt(receipt);
                  setReceipts(receiptInbox());
                  const next = await readBalance();
                  if (next) setCredits(next);
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setOpenReceipt(receipt);
                } catch (error) {
                  Alert.alert("That didn't go through", String(error));
                } finally {
                  setBuying(null);
                }
              })();
            },
          },
        ]
      );
    },
    [billingEmail, household.householdName, household.id, readBalance]
  );

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
        <Text style={[typography.headline, { color: c.text }]}>Credits</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}>
        <CreditSummaryCard summary={credits} />

        {isAdmin ? (
          <>
            <Animated.View entering={FadeInDown.delay(80).duration(280)} style={{ gap: 8 }}>
              <View style={styles.groupHead}>
                <View style={[styles.groupMoji, { backgroundColor: `${TOPUP_TONE}22` }]}>
                  <Moji name="moneyBag" size={16} />
                </View>
                <Text style={[styles.groupLabel, { color: TOPUP_TONE }]}>Buy more actions</Text>
              </View>

              {topUpBalance > 0 ? (
                <LinearGradient
                  colors={[`${TOPUP_TONE}33`, `${TOPUP_TONE}0D`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.balance, { borderColor: `${TOPUP_TONE}55` }]}>
                  <Text style={[styles.balanceValue, { color: c.text }]}>{topUpBalance}</Text>
                  <Text style={[styles.balanceCaption, { color: TOPUP_TONE }]}>
                    bought and unspent · never expires
                  </Text>
                </LinearGradient>
              ) : null}

              <View style={styles.packRow}>
                {packs.map((pack) => (
                  <PackCard
                    key={pack.key}
                    pack={pack}
                    busy={buying === pack.key}
                    disabled={buying != null}
                    onPress={() => buy(pack)}
                  />
                ))}
              </View>

              <Text style={[styles.mockNote, { color: c.textSubtle }]}>
                Test purchases. Nothing is charged; the actions and receipts are real so the flow
                can be checked before the card reader is wired up.
              </Text>
            </Animated.View>

            {receipts.length > 0 ? (
              <Animated.View entering={FadeInDown.delay(140).duration(280)} style={{ gap: 8 }}>
                <View style={styles.groupHead}>
                  <View style={[styles.groupMoji, { backgroundColor: '#4FA3FF22' }]}>
                    <Moji name="receipt" size={16} />
                  </View>
                  <Text style={[styles.groupLabel, { color: '#4FA3FF' }]}>Receipts</Text>
                </View>
                <View
                  style={[
                    styles.card,
                    { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
                  ]}>
                  {receipts.map((receipt, index) => (
                    <Pressable
                      key={receipt.orderId}
                      onPress={() => setOpenReceipt(receipt)}
                      accessibilityRole="button"
                      accessibilityLabel={`Receipt ${receipt.orderId}`}
                      style={({ pressed }) => [
                        styles.receiptRow,
                        index > 0 && {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: glassBorder(0.08),
                        },
                        pressed && { opacity: 0.6 },
                      ]}>
                      <Moji name="receipt" size={18} />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={[styles.receiptTitle, { color: c.text }]}>
                          {receiptLine(receipt)}
                        </Text>
                        <Text style={[styles.receiptSub, { color: c.textMuted }]}>
                          {new Date(receipt.purchasedAt).toLocaleString()} · {receipt.to}
                        </Text>
                      </View>
                      <Text style={[styles.chevron, { color: c.textSubtle }]}>›</Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            ) : null}
          </>
        ) : null}

        {openReceipt ? (
          <Animated.View
            entering={FadeInDown.duration(220)}
            style={[
              styles.receiptCard,
              { backgroundColor: glassFill(isDark), borderColor: `${TOPUP_TONE}55` },
            ]}>
            <View style={styles.receiptHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.receiptEyebrow, { color: TOPUP_TONE }]}>
                  Emailed to {openReceipt.to}
                </Text>
                <Text style={[styles.receiptSubject, { color: c.text }]}>
                  Your ChoreMaxx receipt
                </Text>
              </View>
              <Pressable
                onPress={() => setOpenReceipt(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close the receipt">
                <MaterialIcons name="close" size={20} color={c.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.receiptBody, { color: c.textSoft }]}>{receiptBody(openReceipt)}</Text>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}


/**
 * The two pots, side by side, so nobody mistakes one for the other: an allowance that empties
 * every month, and credits that simply sit there until they're used.
 */
function CreditSummaryCard({ summary }: { summary: CreditSummary }) {
  const { c, glassBorder, isDark } = useOrbitColors();
  const paying = spendsFrom(summary);

  return (
    <Animated.View entering={FadeInDown.duration(280)} style={{ gap: 10 }}>
      <LinearGradient
        colors={[`${TOPUP_TONE}2E`, `${TOPUP_TONE}0A`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.bank, { borderColor: `${TOPUP_TONE}55` }]}>
        <Text style={[styles.bankLabel, { color: TOPUP_TONE }]}>CREDIT BALANCE</Text>
        <Text style={[styles.bankValue, { color: c.text }]}>{summary.balance}</Text>
        <Text style={[styles.bankCaption, { color: c.textSoft }]}>
          Bought and unspent. These never expire — they carry over every month.
        </Text>
      </LinearGradient>

      <View style={styles.potRow}>
        <View
          style={[
            styles.pot,
            { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
          ]}>
          <Text style={[styles.potValue, { color: c.text }]}>{summary.monthlyLeft}</Text>
          <Text style={[styles.potLabel, { color: c.textMuted }]}>
            of {TOKENS_PER_MONTH} this month
          </Text>
          <Text style={[styles.potNote, { color: c.textSubtle }]}>
            Back on {formatResetDate()}
          </Text>
        </View>
        <View
          style={[
            styles.pot,
            { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
          ]}>
          <Text style={[styles.potValue, { color: c.text }]}>{summary.totalAvailable}</Text>
          <Text style={[styles.potLabel, { color: c.textMuted }]}>can be spent now</Text>
          <Text style={[styles.potNote, { color: c.textSubtle }]}>
            {paying === 'credits'
              ? 'Spending credits'
              : paying === 'allowance'
                ? 'Spending the month first'
                : 'Nothing left — top up'}
          </Text>
        </View>
      </View>

      {summary.rows.length > 0 ? (
        <View
          style={[
            styles.card,
            { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
          ]}>
          {summary.rows.map((row, index) => (
            <View
              key={row.id}
              style={[
                styles.ledgerRow,
                index > 0 && {
                  borderTopColor: glassBorder(0.08),
                  borderTopWidth: StyleSheet.hairlineWidth,
                },
              ]}>
              <Moji name="gem" size={16} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={[styles.ledgerTitle, { color: c.text }]} numberOfLines={1}>
                  {row.pack}
                </Text>
                <Text style={[styles.ledgerSub, { color: c.textSubtle }]}>
                  {new Date(row.at).toLocaleDateString()} · {row.spent} used
                </Text>
              </View>
              <Text style={[styles.ledgerLeft, { color: row.left > 0 ? TOPUP_TONE : c.textSubtle }]}>
                {row.left} left
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

function PackCard({
  pack,
  busy,
  disabled,
  onPress,
}: {
  pack: TopUpPack;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { c, glass, glassBorder, isDark } = useOrbitColors();
  const tone = pack.best ? TOPUP_TONE : c.textMuted;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${pack.label} for ${formatPrice(pack.priceUsd)}, ${formatPerAction(
        pack.centsPerAction
      )}${pack.best ? ', best value' : ''}`}
      style={({ pressed }) => [
        styles.pack,
        {
          backgroundColor: pack.best ? (isDark ? `${TOPUP_TONE}1A` : `${TOPUP_TONE}12`) : glass(0.05),
          borderColor: pack.best ? `${TOPUP_TONE}77` : glassBorder(0.1),
          opacity: disabled && !busy ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}>
      {pack.savingLabel ? (
        <View style={[styles.saveTag, { backgroundColor: `${TOPUP_TONE}26` }]}>
          <Text style={[styles.saveText, { color: TOPUP_TONE }]}>{pack.savingLabel}</Text>
        </View>
      ) : (
        <View style={styles.saveSpacer} />
      )}
      <Text style={[styles.packTokens, { color: c.text }]}>{pack.tokens}</Text>
      <Text style={[styles.packUnit, { color: c.textMuted }]}>actions</Text>
      <Text style={[styles.packPrice, { color: tone }]}>
        {busy ? '…' : formatPrice(pack.priceUsd)}
      </Text>
      <Text style={[styles.packEach, { color: c.textSubtle }]}>
        {formatPerAction(pack.centsPerAction)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bank: {
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 1,
    gap: 2,
    padding: 18,
  },
  bankLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  bankValue: { fontSize: 44, fontWeight: '900', letterSpacing: -1.5, lineHeight: 48 },
  bankCaption: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  potRow: { flexDirection: 'row', gap: 10 },
  pot: {
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    padding: 14,
  },
  potValue: { fontSize: 24, fontWeight: '900', letterSpacing: -0.6 },
  potLabel: { fontSize: 12.5, lineHeight: 16 },
  potNote: { fontSize: 11, marginTop: 2 },
  ledgerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
  },
  ledgerTitle: { fontSize: 14.5, fontWeight: '700' },
  ledgerSub: { fontSize: 11.5 },
  ledgerLeft: { fontSize: 13, fontWeight: '800' },
  root: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 8 },
  groupHead: { alignItems: 'center', flexDirection: 'row', gap: 8, marginLeft: 2, marginTop: 8 },
  groupMoji: {
    alignItems: 'center',
    borderRadius: 9,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  groupLabel: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.2 },
  balance: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    gap: 2,
    paddingVertical: 16,
  },
  balanceValue: { fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  balanceCaption: { fontSize: 12.5, fontWeight: '700' },
  packRow: { flexDirection: 'row', gap: 8 },
  pack: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 1,
    paddingBottom: 14,
    paddingTop: 8,
  },
  saveTag: { borderRadius: 999, marginBottom: 4, paddingHorizontal: 8, paddingVertical: 3 },
  saveText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  saveSpacer: { height: 21 },
  packTokens: { fontSize: 24, fontWeight: '900', letterSpacing: -0.6 },
  packUnit: { fontSize: 11, marginTop: -2 },
  packPrice: { fontSize: 16, fontWeight: '800', marginTop: 6 },
  packEach: { fontSize: 10.5 },
  mockNote: { fontSize: 11.5, lineHeight: 16, paddingHorizontal: 2 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  receiptRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  receiptTitle: { fontSize: 14, fontWeight: '600' },
  receiptSub: { fontSize: 11.5 },
  chevron: { fontSize: 22 },
  receiptCard: { borderRadius: 20, borderWidth: 1, gap: 10, padding: 16 },
  receiptHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  receiptEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  receiptSubject: { fontSize: 16, fontWeight: '800' },
  receiptBody: { fontSize: 12.5, fontVariant: ['tabular-nums'], lineHeight: 19 },
});

/** Sidekicks never get Poppins — any way in (a link, a notification, a stale tab) lands on Home. */
export default function PoppinsCreditsScreen() {
  const { currentMember } = useOrbit();
  if (isSidekickRole(currentMember?.role)) {
    return <Redirect href={'/(tabs)' as never} />;
  }
  return <PoppinsCreditsScreenInner />;
}
