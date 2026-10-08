/**
 * Settings → Subscription, once the household is covered.
 *
 *   ┌──────────────────────────────────────────┐
 *   │  PREMIUM · YEARLY            [ Active ]  │
 *   │   ◔  283 days left                       │
 *   │      Renews October 14 · $49.99/year     │
 *   ├──────────────────────────────────────────┤
 *   │  Manage or cancel            ›           │  ← Apple's own sheet
 *   │  Restore purchases           ›           │
 *   │  Poppins credits             ›           │
 *   ├──────────────────────────────────────────┤
 *   │  HISTORY                                 │
 *   │  Oct 14, 2026  Payment · Yearly          │
 *   │  Oct 7, 2026   Free trial · 7 days       │
 *   └──────────────────────────────────────────┘
 *
 * Cancelling is Apple's: an app cannot cancel a subscription itself, only open the sheet where
 * the person does. So "Manage or cancel" opens that sheet, and the screen re-reads the status
 * when it closes, so "Renews" becomes "Ends" straight away.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { SettingsGroup, SettingsNavRow } from '@/components/orbit/settings/grouped';
import { SettingsModalChrome } from '@/components/orbit/settings/modal-chrome';
import { BILLING_TRIAL_DAYS, IAP_SUBSCRIPTIONS, type EntitlementState } from '@/constants/billing';
import { CHOREMAXX_LEGAL } from '@/constants/choremaxx-brand';
import type { RenewalState, StorePrice } from '@/lib/billing/iap';
import {
  daysLeftLabel,
  planLabelFor,
  subscriptionSummary,
  type HistoryEntry,
} from '@/lib/billing/subscription-status';
import { useShowBillingDiagnostics } from '@/lib/billing/store-environment';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

type Props = {
  entitlement: EntitlementState;
  renewal: RenewalState;
  history: HistoryEntry[];
  storePrices: Record<string, StorePrice>;
  busy?: boolean;
  statusMessage?: string | null;
  errorMessage?: string | null;
  /** The plan this iPhone's own Apple ID holds, if any. Null when the household is covered some
   * other way (another admin's Apple ID, or a trial recorded on the household). */
  deviceProductId?: string | null;
  onManage: () => void;
  onRestore: () => void;
  /** Buy a plan outright — offered during a trial. Never a free-trial button: inside the app
   * the trial has already been used. */
  onSubscribe?: (period: 'monthly' | 'yearly') => void;
};

function Ring({ fraction, color, track }: { fraction: number; color: string; track: string }) {
  const size = 64;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - clamped)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

function longDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SubscriptionDashboard({
  entitlement,
  renewal,
  history,
  storePrices,
  busy,
  statusMessage,
  errorMessage,
  deviceProductId = null,
  onManage,
  onRestore,
  onSubscribe,
}: Props) {
  const insets = useSafeAreaInsets();
  const showDiagnostics = useShowBillingDiagnostics();
  const { c, glass, glassBorder } = useOrbitColors();
  const summary = subscriptionSummary(entitlement, renewal);
  const toneColor = summary.tone === 'warn' ? '#E9A23B' : summary.tone === 'good' ? '#3BB273' : c.textMuted;
  const yearly = entitlement.productId === IAP_SUBSCRIPTIONS.yearly.productId;
  const catalog = yearly ? IAP_SUBSCRIPTIONS.yearly : IAP_SUBSCRIPTIONS.monthly;
  const price = storePrices[catalog.productId]?.display ?? `$${catalog.priceUsd}`;
  const priceLine = `${price}/${yearly ? 'year' : 'month'}`;

  return (
    <SettingsModalChrome
      backLabel="Settings"
      title="Subscription"
      purpose="Your plan, when it renews, and what you've paid.">
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          entering={FadeInDown.duration(380)}
          style={[styles.hero, { backgroundColor: glass(0.05), borderColor: glassBorder(0.12) }]}>
          <View style={styles.heroTop}>
            <Text style={[styles.plan, { color: c.textMuted }]}>{summary.planLabel.toUpperCase()}</Text>
            <View style={[styles.chip, { backgroundColor: `${toneColor}22` }]}>
              <Text style={[styles.chipText, { color: toneColor }]}>{summary.statusLabel}</Text>
            </View>
          </View>
          <View style={styles.heroMain}>
            <Ring fraction={summary.remaining} color={toneColor} track={glassBorder(0.14)} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.daysLeft, { color: c.text }]}>{daysLeftLabel(summary.daysLeft)}</Text>
              <Text style={[styles.next, { color: c.textMuted }]}>
                {summary.nextLine}
                {summary.willRenew === false ? '' : ` · ${priceLine}`}
              </Text>
            </View>
          </View>
          {renewal.billingIssue ? (
            <Text style={[styles.note, { color: '#E9A23B', fontWeight: '700' }]}>
              Apple couldn&apos;t charge your card.{' '}
              {renewal.graceEndsAt
                ? `Everything stays on until ${longDate(renewal.graceEndsAt)} while Apple retries.`
                : 'Everything stays on for a few days while Apple retries.'}{' '}
              Update your payment method from Manage below.
            </Text>
          ) : null}
                    {summary.inTrial && summary.willRenew === true ? (
            <Text style={[styles.note, { color: c.textMuted }]}>
              Your {BILLING_TRIAL_DAYS}-day free trial turns into your subscription automatically. Apple charges{' '}
              {priceLine} on {longDate(summary.endsAt)} unless you cancel at least 24 hours before.
            </Text>
          ) : null}
          {summary.willRenew === false ? (
            <Text style={[styles.note, { color: c.textMuted }]}>
              Renewal is off. Everything stays open until {longDate(summary.endsAt)}. Turn it back on
              any time from Manage.
            </Text>
          ) : null}
          {renewal.pendingProductId ? (
            <Text style={[styles.note, { color: c.textMuted }]}>
              Switching to {planLabelFor(renewal.pendingProductId)} at the next renewal.
            </Text>
          ) : null}
        </Animated.View>

        {statusMessage ? <Text style={[styles.status, { color: c.primary }]}>{statusMessage}</Text> : null}
        {errorMessage ? <Text style={[styles.status, { color: c.danger }]}>{errorMessage}</Text> : null}

        <PlanPicker
          storePrices={storePrices}
          deviceProductId={deviceProductId}
          householdEndsAt={summary.endsAt}
          busy={busy}
          onSubscribe={onSubscribe}
          onManage={onManage}
        />

        <SettingsGroup header="Manage">
          <SettingsNavRow
            icon="manage-accounts"
            iconColor="#5B8DEF"
            label={busy ? 'Opening…' : 'Manage or cancel subscription'}
            subtitle="Cancel, turn off renewal or switch plan — in Apple's settings"
            onPress={onManage}
          />
          <SettingsNavRow
            icon="restore"
            iconColor="#E9B44C"
            label="Restore purchases"
            subtitle="Bring back a subscription bought on this Apple ID"
            onPress={onRestore}
          />
          <SettingsNavRow
            icon="bolt"
            iconColor="#9B6BEF"
            label="Poppins credits"
            subtitle="Your monthly actions and extra packs"
            onPress={() => router.push('/poppins-credits' as never)}
          />
          {showDiagnostics ? (
          <SettingsNavRow
            icon="science"
            iconColor="#8E8E93"
            label="Purchase diagnostics"
            subtitle="What StoreKit and the household say — for sandbox testing"
            onPress={() => router.push('/billing-diagnostics' as never)}
            last
          />
          ) : null}
        </SettingsGroup>

        <SettingsGroup header="History">
          {history.length === 0 ? (
            <Text style={[styles.empty, { color: c.textMuted }]}>
              Your trial and payments will appear here.
            </Text>
          ) : (
            history.map((entry, index) => (
              <View
                key={entry.id}
                style={[
                  styles.historyRow,
                  index < history.length - 1 && {
                    borderBottomColor: glassBorder(0.08),
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                ]}>
                <MaterialIcons
                  name={entry.kind === 'trial' ? 'card-giftcard' : 'receipt-long'}
                  size={18}
                  color={entry.kind === 'trial' ? '#3BB273' : c.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyTitle, { color: c.text }]}>
                    {entry.kind === 'trial' ? 'Free trial' : 'Payment'} ·{' '}
                    {planLabelFor(entry.productId).replace(' plan', '')}
                  </Text>
                  <Text style={[styles.historySub, { color: c.textMuted }]}>
                    {longDate(entry.startedAt)}
                    {entry.endsAt ? ` – ${longDate(entry.endsAt)}` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </SettingsGroup>

        <Text style={[styles.footnote, { color: c.textSubtle }]}>
          Payments go through your Apple ID. Your receipts are in the iPhone Settings app, under
          your name, in Media & Purchases, then Purchase History.
        </Text>
        <View style={styles.links}>
          <Pressable onPress={() => void Linking.openURL(CHOREMAXX_LEGAL.termsUrl)} hitSlop={10}>
            <Text style={[styles.link, { color: c.textMuted }]}>Terms of Use</Text>
          </Pressable>
          <Text style={{ color: c.textSubtle }}>·</Text>
          <Pressable onPress={() => void Linking.openURL(CHOREMAXX_LEGAL.privacyUrl)} hitSlop={10}>
            <Text style={[styles.link, { color: c.textMuted }]}>Privacy Policy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SettingsModalChrome>
  );
}

/**
 * Monthly and Yearly, side by side, right under the countdown. Tap one to choose it — it lifts,
 * its border lights and a check appears — then one button underneath does the right thing:
 *
 *   this iPhone holds no plan      Subscribe · <price>        → Apple's purchase sheet
 *   this iPhone holds this plan    Your plan (disabled)
 *   this iPhone holds the other    Switch to <plan>           → Apple's subscription sheet
 *
 * Never a free-trial button: inside the app, the trial has already been used.
 */
function PlanPicker({
  storePrices,
  deviceProductId,
  householdEndsAt,
  busy,
  onSubscribe,
  onManage,
}: {
  storePrices: Record<string, StorePrice>;
  deviceProductId: string | null;
  householdEndsAt: string | null;
  busy?: boolean;
  onSubscribe?: (period: 'monthly' | 'yearly') => void;
  onManage: () => void;
}) {
  const { c, glass, glassBorder } = useOrbitColors();
  const heldPeriod =
    deviceProductId === IAP_SUBSCRIPTIONS.yearly.productId
      ? 'yearly'
      : deviceProductId === IAP_SUBSCRIPTIONS.monthly.productId
        ? 'monthly'
        : null;
  const [picked, setPicked] = useState<'monthly' | 'yearly'>(heldPeriod === 'yearly' ? 'monthly' : 'yearly');
  const priceOf = (period: 'monthly' | 'yearly') =>
    storePrices[IAP_SUBSCRIPTIONS[period].productId]?.display ?? `$${IAP_SUBSCRIPTIONS[period].priceUsd}`;

  const isHeld = heldPeriod === picked;
  const cta = isHeld
    ? 'Your plan'
    : heldPeriod
      ? `Switch to ${picked === 'yearly' ? 'Yearly' : 'Monthly'}`
      : `Subscribe ${picked === 'yearly' ? 'yearly' : 'monthly'} · ${priceOf(picked)}`;
  const act = isHeld ? null : heldPeriod ? onManage : onSubscribe ? () => onSubscribe(picked) : null;

  return (
    <Animated.View entering={FadeInDown.delay(80).duration(380)} style={{ gap: 10 }}>
      <Text style={[styles.sectionLabel, { color: c.textMuted }]}>PLANS</Text>
      <View style={styles.planRow}>
        {(['monthly', 'yearly'] as const).map((period, index) => (
          <PlanCard
            key={period}
            index={index}
            title={period === 'yearly' ? 'Yearly' : 'Monthly'}
            price={priceOf(period)}
            per={period === 'yearly' ? 'per year' : 'per month'}
            badge={period === 'yearly' ? IAP_SUBSCRIPTIONS.yearly.savingsLabel : heldPeriod === period ? 'Your plan' : null}
            held={heldPeriod === period}
            selected={picked === period}
            onPress={() => setPicked(period)}
            disabled={busy}
            colors={{ text: c.text, muted: c.textMuted, accent: c.primary, fill: glass(0.05), border: glassBorder(0.12) }}
          />
        ))}
      </View>
      <Pressable
        disabled={!act || busy}
        onPress={act ?? undefined}
        accessibilityRole="button"
        accessibilityLabel={cta}
        style={({ pressed }) => [
          styles.planCta,
          {
            backgroundColor: act ? c.primary : 'transparent',
            borderColor: act ? c.primary : glassBorder(0.16),
            opacity: busy ? 0.55 : pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}>
        <Text style={[styles.planCtaText, { color: act ? '#fff' : c.textMuted }]}>{busy ? 'Please wait…' : cta}</Text>
      </Pressable>
      <Text style={[styles.note, { color: c.textMuted }]}>
        {heldPeriod
          ? 'Plan changes are made in Apple’s subscription settings and take effect at your next renewal or straight away, as Apple decides.'
          : householdEndsAt
            ? `Your household is covered until ${longDate(householdEndsAt)}. Subscribing here starts a plan on this iPhone’s Apple ID. `
            : ''}
        Payment is charged to your Apple ID when you confirm and renews automatically unless cancelled at least 24 hours before the end of the period.
      </Text>
    </Animated.View>
  );
}

function PlanCard({
  index,
  title,
  price,
  per,
  badge,
  held,
  selected,
  onPress,
  disabled,
  colors,
}: {
  index: number;
  title: string;
  price: string;
  per: string;
  badge: string | null;
  held: boolean;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  colors: { text: string; muted: string; accent: string; fill: string; border: string };
}) {
  const lift = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    lift.value = withSpring(selected ? 1 : 0, { damping: 14, stiffness: 180 });
  }, [selected, lift]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * lift.value }, { scale: 1 + 0.02 * lift.value }],
    shadowOpacity: 0.25 * lift.value,
  }));
  return (
    <Animated.View entering={FadeInDown.delay(140 + index * 90).springify().damping(16)} style={[{ flex: 1 }, style, styles.planShadow]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${title}, ${price} ${per}${held ? ', your plan' : ''}`}
        style={[
          styles.planCard,
          { backgroundColor: colors.fill, borderColor: selected ? colors.accent : colors.border, borderWidth: selected ? 2 : 1 },
        ]}>
        <View style={styles.planTop}>
          <Text style={[styles.planName, { color: colors.muted }]}>{title.toUpperCase()}</Text>
          {selected ? <MaterialIcons name="check-circle" size={18} color={colors.accent} /> : <View style={[styles.planDot, { borderColor: colors.border }]} />}
        </View>
        <Text style={[styles.planPrice, { color: colors.text }]}>{price}</Text>
        <Text style={[styles.planPer, { color: colors.muted }]}>{per}</Text>
        {badge ? (
          <View style={[styles.planBadge, { backgroundColor: `${colors.accent}22` }]}>
            <Text style={[styles.planBadgeText, { color: colors.accent }]}>{badge}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  planShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowRadius: 16 },
  planTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  planDot: { borderRadius: 9, borderWidth: 1.5, height: 18, width: 18 },
  planBadge: { alignSelf: 'flex-start', borderRadius: 999, marginTop: 8, paddingHorizontal: 8, paddingVertical: 3 },
  planBadgeText: { fontSize: 11.5, fontWeight: '800' },
  planCta: { alignItems: 'center', borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 50 },
  planCtaText: { fontSize: 16, fontWeight: '800' },
  body: { gap: 18, paddingHorizontal: 20, paddingTop: 8 },
  hero: { borderCurve: 'continuous', borderRadius: 22, borderWidth: 1, gap: 14, padding: 18 },
  heroTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  plan: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12.5, fontWeight: '800' },
  heroMain: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  daysLeft: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  next: { fontSize: 15, fontWeight: '600' },
  note: { fontSize: 13.5, lineHeight: 19 },
  status: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  empty: { fontSize: 14, paddingHorizontal: 16, paddingVertical: 14 },
  historyRow: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  historyTitle: { fontSize: 15, fontWeight: '600' },
  historySub: { fontSize: 13, marginTop: 2 },
  footnote: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  sectionLabel: { fontSize: 12.5, fontWeight: '800', letterSpacing: 0.6, paddingHorizontal: 4 },
  planRow: { flexDirection: 'row', gap: 10 },
  planCard: { borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, flex: 1, gap: 4, padding: 14 },
  planName: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  planPrice: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  planPer: { fontSize: 12.5 },
  planBtn: { alignItems: 'center', borderRadius: 999, borderWidth: 1, marginTop: 8, minHeight: 38, justifyContent: 'center' },
  planBtnText: { fontSize: 14, fontWeight: '700' },
  links: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center' },
  link: { fontSize: 14, fontWeight: '500' },
});
