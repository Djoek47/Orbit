/**
 * Poppins → Credits.
 *
 * Two pots, kept visually separate:
 *   allowance   300 actions / month, resets on the 1st
 *   credits     bought packs that never expire — spent after the month is gone
 *
 * Buys go through `purchaseTokens` so Expo Go mock and native StoreKit share one path.
 * Each successful buy appends to the household bank (never replaces prior balance).
 *
 * Confirm uses native Alert (never orbitAlert) so Settings-under-stack never leaves
 * an invisible touch blocker after a pack tap.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { Moji } from '@/components/orbit/moji/moji';
import { radius, space, typography } from '@/constants/orbit-theme';
import { TOKENS_PER_MONTH } from '@/constants/poppins-ai-rates';
import {
  formatResetDate,
  spendsFrom,
  summarizeCredits,
  type CreditSummary,
} from '@/lib/billing/credit-ledger';
import { isNativeIapAvailable, isUserCancelledPurchase, purchaseTokens } from '@/lib/billing/iap';
import { sendCreditReceiptEmail } from '@/lib/billing/send-credit-receipt';
import { loadTokenGrants } from '@/lib/billing/token-grants';
import { summarizeActUsage } from '@/lib/ai/act-events';
import { showNativeAppError } from '@/lib/errors/show-native-app-error';
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
import { confirmCreditPackPurchase } from '@/lib/ui/settings-native-menus';
import { glassFill, useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';
import { isSidekickRole } from '@/lib/sidekick/permissions';

const TOPUP_TONE = '#FF9F1C';
const TOPUP_DEEP = '#E8780C';
const TOKEN_GLOW = '#FFD28A';

type ReceiptMail =
  | { kind: 'sending' }
  | { kind: 'sent'; to: string }
  | { kind: 'saved' }
  | { kind: 'failed' };

type Congrats = { tokens: number; price: string; receipt: TopUpReceipt };

function PoppinsCreditsScreenInner() {
  const insets = useSafeAreaInsets();
  const { c, glassBorder, isDark } = useOrbitColors();
  const { household, permissions, actEvents, currentMember, currentUser } = useOrbit();
  const isAdmin = permissions.canManageHousehold;

  const monthUsed = useMemo(() => summarizeActUsage(actEvents).tokensUsedThisPeriod, [actEvents]);
  const [credits, setCredits] = useState<CreditSummary>(() => summarizeCredits([], monthUsed));
  const [receipts, setReceipts] = useState<TopUpReceipt[]>(() => receiptInbox());
  const [buying, setBuying] = useState<string | null>(null);
  const [openReceipt, setOpenReceipt] = useState<TopUpReceipt | null>(null);
  const [billingEmail, setBillingEmail] = useState('');
  const [receiptMail, setReceiptMail] = useState<ReceiptMail | null>(null);
  const [congrats, setCongrats] = useState<Congrats | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollToReceipt = useRef(false);
  const purchaseSeq = useRef(0);

  const showReceipt = useCallback((receipt: TopUpReceipt) => {
    scrollToReceipt.current = true;
    setOpenReceipt(receipt);
  }, []);

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
        /* mock mode */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      void readBalance().then((next) => {
        if (next) setCredits(next);
      });
    }, [readBalance])
  );

  const packs = useMemo(() => topUpPacks(), []);
  const mockBuy = !isNativeIapAvailable();

  const runPurchase = useCallback(
    async (pack: TopUpPack) => {
      const seq = ++purchaseSeq.current;
      setBuying(pack.key);
      setCongrats(null);
      setReceiptMail(null);
      setOpenReceipt(null);
      try {
        if (!household.id) throw new Error('no household yet');
        const grant = await purchaseTokens(pack.key, household.id);
        const receiptTo = billingEmail || currentUser?.email || 'this device (no email on file)';
        const receipt = {
          ...buildTopUpReceipt({
            packKey: pack.key,
            to: receiptTo,
            householdName: household.householdName,
          }),
          transactionId: grant.transactionId,
          tokens: grant.tokens,
          mock: mockBuy,
        };
        fileReceipt(receipt);
        setReceipts(receiptInbox());
        const next = await readBalance();
        if (next) setCredits(next);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCongrats({ tokens: grant.tokens, price: formatPrice(pack.priceUsd), receipt });
        setReceiptMail({ kind: 'sending' });
        setBuying(null);

        const mailed = await sendCreditReceiptEmail({
          to: billingEmail || currentUser?.email || undefined,
          name: currentMember?.name ?? currentUser?.name,
          tokens: grant.tokens,
          price: formatPrice(pack.priceUsd),
          orderId: receipt.orderId,
          householdName: household.householdName,
          householdId: household.id,
          mock: mockBuy,
          transactionId: grant.transactionId,
        });
        if (seq !== purchaseSeq.current) return;
        if (mailed.ok) {
          setReceiptMail({ kind: 'sent', to: mailed.to });
        } else if (mailed.skipped) {
          setReceiptMail({ kind: 'saved' });
        } else {
          console.warn('poppins-credits receipt email', mailed.error);
          setReceiptMail({ kind: 'failed' });
        }
      } catch (error) {
        // Native Alert + feedback loop — never orbitAlert under Settings (touch freeze).
        if (!isUserCancelledPurchase(error)) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          await showNativeAppError("That didn't go through", error, {
            source: 'poppins-credits',
            category: 'billing',
          });
        }
      } finally {
        if (seq === purchaseSeq.current) setBuying(null);
      }
    },
    [
      billingEmail,
      currentMember?.name,
      currentUser?.email,
      currentUser?.name,
      household.householdName,
      household.id,
      mockBuy,
      readBalance,
    ]
  );

  const buy = useCallback(
    (pack: TopUpPack) => {
      if (buying != null) return;
      confirmCreditPackPurchase({
        title: `${pack.label} · ${formatPrice(pack.priceUsd)}`,
        message: mockBuy
          ? `Adds ${pack.tokens} actions to your bank. Test buy — no charge.`
          : `Adds ${pack.tokens} actions to your credit bank.`,
        confirmLabel: mockBuy ? 'Buy (test)' : 'Buy',
        onConfirm: () => {
          void runPurchase(pack);
        },
      });
    },
    [buying, mockBuy, runPurchase]
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top + 8 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={isDark ? [`${TOPUP_TONE}18`, 'transparent', 'transparent'] : [`${TOPUP_TONE}10`, 'transparent']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

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
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <CreditSummaryCard summary={credits} />

        {congrats ? (
          <Animated.View
            entering={FadeInDown.duration(300).springify().damping(18)}
            style={[styles.congrats, { borderColor: `${TOPUP_TONE}55` }]}
            accessibilityLiveRegion="polite">
            <LinearGradient
              colors={[`${TOPUP_TONE}2E`, `${TOPUP_DEEP}0F`, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View style={styles.congratsHead}>
              <View style={[styles.congratsIcon, { backgroundColor: `${TOPUP_TONE}22` }]}>
                <Moji name="sparkles" size={22} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={[styles.congratsEyebrow, { color: TOPUP_TONE }]}>
                  {mockBuy ? 'Test purchase · no charge' : 'Purchase complete'}
                </Text>
                <Text style={[typography.title2, { color: c.text }]}>Congratulations!</Text>
              </View>
            </View>
            <Text style={[styles.congratsBody, { color: c.textSoft }]}>
              <Text style={[styles.congratsBodyStrong, { color: c.text }]}>
                {congrats.tokens.toLocaleString()} actions
              </Text>{' '}
              for {congrats.price} are in your bank. They never expire.
            </Text>
            <ReceiptMailRow mail={receiptMail} />
            <View style={styles.congratsActions}>
              <Pressable
                onPress={() => showReceipt(congrats.receipt)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.congratsBtn,
                  {
                    backgroundColor: glassFill(isDark, 0.06),
                    borderColor: glassBorder(0.14),
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}>
                <Text style={[styles.congratsBtnText, { color: c.text }]}>View receipt</Text>
              </Pressable>
              <Pressable
                onPress={() => setCongrats(null)}
                accessibilityRole="button"
                accessibilityLabel="Done, dismiss congratulations"
                style={({ pressed }) => [
                  styles.congratsBtn,
                  {
                    backgroundColor: TOPUP_TONE,
                    borderColor: TOPUP_TONE,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}>
                <Text style={[styles.congratsBtnText, { color: '#1A1006' }]}>Done</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {isAdmin ? (
          <>
            <Animated.View entering={FadeInDown.delay(80).duration(280)} style={{ gap: 10 }}>
              <View style={styles.groupHead}>
                <View style={[styles.groupMoji, { backgroundColor: `${TOPUP_TONE}28` }]}>
                  <Moji name="gem" size={18} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.groupLabel, { color: TOPUP_TONE }]}>Buy more actions</Text>
                  <Text style={[styles.groupSub, { color: c.textSubtle }]}>
                    Tokens stack forever · spent after the month
                  </Text>
                </View>
              </View>

              <View style={styles.packRow}>
                {packs.map((pack, index) => (
                  <PackCard
                    key={pack.key}
                    pack={pack}
                    busy={buying === pack.key}
                    disabled={buying != null}
                    index={index}
                    onPress={() => buy(pack)}
                  />
                ))}
              </View>

              {mockBuy ? (
                <Text style={[styles.mockNote, { color: c.textSubtle }]}>
                  Test mode — buys are free and still add to your bank.
                </Text>
              ) : null}
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
                      onPress={() => showReceipt(receipt)}
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
            onLayout={(event) => {
              if (!scrollToReceipt.current) return;
              scrollToReceipt.current = false;
              scrollRef.current?.scrollTo({
                y: Math.max(0, event.nativeEvent.layout.y - space.sm),
                animated: true,
              });
            }}
            style={[
              styles.receiptCard,
              { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.14) },
            ]}>
            <View style={styles.receiptHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.receiptEyebrow, { color: TOPUP_TONE }]} numberOfLines={1}>
                  {openReceipt.mock ? 'Test receipt · on this device' : `For ${openReceipt.to}`}
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

function ReceiptMailRow({ mail }: { mail: ReceiptMail | null }) {
  const { c, glassBorder, isDark } = useOrbitColors();
  if (!mail) return null;
  const label =
    mail.kind === 'sending'
      ? 'Sending your receipt…'
      : mail.kind === 'sent'
        ? mail.to
          ? `Receipt sent to ${mail.to}`
          : 'Receipt sent to your email'
        : mail.kind === 'saved'
          ? 'Receipt saved on this device'
          : 'Receipt saved here · the email didn’t send';
  const icon: keyof typeof MaterialIcons.glyphMap =
    mail.kind === 'sent' ? 'mark-email-read' : mail.kind === 'failed' ? 'info-outline' : 'receipt-long';
  const iconColor = mail.kind === 'sent' ? c.success : mail.kind === 'failed' ? c.warning : c.textMuted;
  return (
    <Animated.View
      key={mail.kind}
      entering={FadeIn.duration(200)}
      style={[
        styles.mailRow,
        { backgroundColor: glassFill(isDark, 0.05), borderColor: glassBorder(0.1) },
      ]}
      accessibilityLiveRegion="polite">
      {mail.kind === 'sending' ? (
        <ActivityIndicator size="small" color={c.textMuted} />
      ) : (
        <MaterialIcons name={icon} size={16} color={iconColor} />
      )}
      <Text style={[styles.mailText, { color: c.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </Animated.View>
  );
}

function TokenOrb() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    const ease = Easing.inOut(Easing.quad);
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1600, easing: ease }),
        withTiming(1, { duration: 1600, easing: ease })
      ),
      -1,
      false
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  return (
    <Animated.View style={[styles.orb, style]}>
      <LinearGradient
        colors={[TOKEN_GLOW, TOPUP_TONE, TOPUP_DEEP]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.orbFill}>
        <Moji name="gem" size={28} />
      </LinearGradient>
    </Animated.View>
  );
}

function CreditSummaryCard({ summary }: { summary: CreditSummary }) {
  const { c, glassBorder, isDark } = useOrbitColors();
  const paying = spendsFrom(summary);

  return (
    <Animated.View entering={FadeInDown.duration(280)} style={{ gap: 10 }}>
      <LinearGradient
        colors={[`${TOPUP_TONE}40`, `${TOPUP_DEEP}14`, `${TOPUP_TONE}08`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.bank, { borderColor: `${TOPUP_TONE}66` }]}>
        <View style={styles.bankTop}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[styles.bankLabel, { color: TOPUP_TONE }]}>CREDIT BALANCE</Text>
            <Animated.Text entering={FadeIn.duration(200)} style={[styles.bankValue, { color: c.text }]}>
              {summary.balance.toLocaleString()}
            </Animated.Text>
            <Text style={[styles.bankCaption, { color: c.textSoft }]}>
              Bought tokens · never expire
            </Text>
          </View>
          <TokenOrb />
        </View>
        {summary.lifetimePurchased > 0 ? (
          <Text style={[styles.bankMeta, { color: c.textSubtle }]}>
            {summary.lifetimePurchased.toLocaleString()} bought lifetime · {summary.lifetimeSpent.toLocaleString()}{' '}
            spent
          </Text>
        ) : null}
      </LinearGradient>

      <View style={styles.potRow}>
        <View
          style={[
            styles.pot,
            { backgroundColor: glassFill(isDark), borderColor: glassBorder(0.1) },
          ]}>
          <Text style={[styles.potEyebrow, { color: c.textSubtle }]}>This month</Text>
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
          <Text style={[styles.potEyebrow, { color: c.textSubtle }]}>Spendable</Text>
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
  index,
  onPress,
}: {
  pack: TopUpPack;
  busy: boolean;
  disabled: boolean;
  index: number;
  onPress: () => void;
}) {
  const { c, glassBorder, isDark } = useOrbitColors();
  const tone = pack.best ? TOPUP_TONE : c.textMuted;
  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 60).duration(280)} style={{ flex: 1 }}>
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
            borderColor: pack.best ? `${TOPUP_TONE}AA` : glassBorder(0.12),
            opacity: disabled && !busy ? 0.5 : pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}>
        <LinearGradient
          colors={
            pack.best
              ? [`${TOPUP_TONE}38`, `${TOPUP_DEEP}18`, isDark ? '#1A1208' : `${TOPUP_TONE}08`]
              : [isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', 'transparent']
          }
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {pack.savingLabel ? (
          <View style={[styles.saveTag, { backgroundColor: TOPUP_TONE }]}>
            <Text style={styles.saveText}>{pack.savingLabel}</Text>
          </View>
        ) : (
          <View style={styles.saveSpacer} />
        )}
        <View style={[styles.packGem, { backgroundColor: `${TOPUP_TONE}22` }]}>
          <Moji name="gem" size={20} />
        </View>
        <Text style={[styles.packTokens, { color: c.text }]}>{pack.tokens}</Text>
        <Text style={[styles.packUnit, { color: c.textMuted }]}>actions</Text>
        <Text style={[styles.packPrice, { color: tone }]}>
          {busy ? 'Adding…' : formatPrice(pack.priceUsd)}
        </Text>
        <Text style={[styles.packEach, { color: c.textSubtle }]}>
          {formatPerAction(pack.centsPerAction)}
        </Text>
        <View
          style={[
            styles.packCta,
            {
              backgroundColor: pack.best ? TOPUP_TONE : `${TOPUP_TONE}22`,
              borderColor: pack.best ? TOPUP_TONE : `${TOPUP_TONE}44`,
            },
          ]}>
          <Text style={[styles.packCtaText, { color: pack.best ? '#1A1006' : TOPUP_TONE }]}>
            {busy ? '…' : 'Get'}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bank: {
    borderCurve: 'continuous',
    borderRadius: 24,
    borderWidth: 1.5,
    gap: 10,
    overflow: 'hidden',
    padding: 18,
  },
  bankTop: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  bankLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  bankValue: { fontSize: 48, fontWeight: '900', letterSpacing: -1.5, lineHeight: 52 },
  bankCaption: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  bankMeta: { fontSize: 11.5, fontWeight: '600' },
  orb: {
    height: 64,
    width: 64,
  },
  orbFill: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  potRow: { flexDirection: 'row', gap: 10 },
  pot: {
    borderCurve: 'continuous',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    padding: 14,
  },
  potEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
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
    zIndex: 1,
  },
  content: { gap: 16, paddingHorizontal: 16, paddingTop: 8 },
  groupHead: { alignItems: 'center', flexDirection: 'row', gap: 10, marginLeft: 2, marginTop: 8 },
  groupMoji: {
    alignItems: 'center',
    borderRadius: 11,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  groupLabel: { fontSize: 13.5, fontWeight: '800', letterSpacing: 0.15 },
  groupSub: { fontSize: 11.5, marginTop: 1 },
  packRow: { flexDirection: 'row', gap: 8 },
  pack: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1.5,
    flex: 1,
    gap: 1,
    overflow: 'hidden',
    paddingBottom: 12,
    paddingTop: 8,
  },
  saveTag: { borderRadius: 999, marginBottom: 4, paddingHorizontal: 8, paddingVertical: 3 },
  saveText: { color: '#1A1006', fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  saveSpacer: { height: 21 },
  packGem: {
    alignItems: 'center',
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    marginBottom: 2,
    width: 36,
  },
  packTokens: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  packUnit: { fontSize: 11, marginTop: -2 },
  packPrice: { fontSize: 16, fontWeight: '800', marginTop: 6 },
  packEach: { fontSize: 10.5 },
  packCta: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    minWidth: 56,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  packCtaText: { fontSize: 12, fontWeight: '800' },
  mockNote: { fontSize: 11.5, lineHeight: 16, paddingHorizontal: 2 },
  congrats: {
    borderCurve: 'continuous',
    borderRadius: radius.card,
    borderWidth: 1,
    gap: space.sm,
    overflow: 'hidden',
    padding: space.md,
  },
  congratsHead: { alignItems: 'center', flexDirection: 'row', gap: space.sm },
  congratsIcon: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.control,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  congratsEyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  congratsBody: { ...typography.subheadline },
  congratsBodyStrong: { fontVariant: ['tabular-nums'], fontWeight: '700' },
  congratsActions: { flexDirection: 'row', gap: space.xs, marginTop: space.xxs },
  congratsBtn: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.full,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: space.md,
  },
  congratsBtnText: { fontSize: 15, fontWeight: '700' },
  mailRow: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
  },
  mailText: { ...typography.footnote, flex: 1 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 14 },
  receiptRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
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

/** Sidekicks never get Poppins — any way in lands on Home. */
export default function PoppinsCreditsScreen() {
  const { currentMember } = useOrbit();
  if (isSidekickRole(currentMember?.role)) {
    return <Redirect href={'/(tabs)' as never} />;
  }
  return <PoppinsCreditsScreenInner />;
}
