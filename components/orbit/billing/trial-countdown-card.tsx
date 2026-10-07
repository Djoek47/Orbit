/**
 * How long the free trial has left, and exactly what happens when it ends.
 *
 *   ┌────────────────────────────────────────────┐
 *   │  ◔  5 days left in your trial              │
 *   │     Ends Wed, Oct 14 at 9:41 AM            │
 *   │     Then Premium · $49.99/year, renews     │
 *   │     automatically. Manage ›                │
 *   └────────────────────────────────────────────┘
 *
 * The ring empties as the week goes, so the state reads at a glance without the words. The
 * last 48 hours turn it the warning colour. The renewal line is there on purpose: a trial that
 * converts without the household remembering it would is the commonest subscription complaint
 * there is, and Apple expects the terms to be in plain sight. "Manage" opens Apple's own
 * subscription screen, the only place a subscription can be cancelled.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { AppText as Text } from '@/components/orbit/app-text';
import { BILLING_TRIAL_DAYS, IAP_SUBSCRIPTIONS } from '@/constants/billing';
import { useAccess } from '@/lib/billing/access-provider';
import { formatPrice } from '@/lib/billing/topup-receipt';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';

/** Apple's own subscription management page. */
const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

const DAY_MS = 86_400_000;

function Ring({ fraction, color, track }: { fraction: number; color: string; track: string }) {
  const size = 44;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
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
        // Start at twelve o'clock and run clockwise, like a clock face counting down.
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export function TrialCountdownCard() {
  const { c, glass, glassBorder } = useOrbitColors();
  const access = useAccess();
  const view = access.view;

  if (!access.ready || view.level !== 'trial' || !view.trialEndsAt || !access.canPurchase) {
    return null;
  }

  const ends = new Date(view.trialEndsAt);
  const msLeft = Math.max(0, ends.getTime() - Date.now());
  const fractionLeft = msLeft / (BILLING_TRIAL_DAYS * DAY_MS);
  const tone = view.trialEndingSoon ? c.warning : '#34D399';

  const plan = Object.values(IAP_SUBSCRIPTIONS).find(
    (p) => p.productId === access.entitlement.productId
  );
  const price = plan
    ? `${formatPrice(plan.priceUsd)}/${plan.period === 'year' ? 'year' : 'month'}`
    : null;

  const when = ends.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const headline =
    view.trialDaysLeft != null && view.trialDaysLeft >= 2
      ? `${view.trialDaysLeft} days left in your trial`
      : view.trialLabel || 'Trial ending';

  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      style={[
        styles.card,
        {
          backgroundColor: view.trialEndingSoon ? `${c.warning}12` : glass(0.05),
          borderColor: view.trialEndingSoon ? `${c.warning}55` : glassBorder(0.1),
        },
      ]}
      accessible
      accessibilityLabel={`${headline}. Ends ${when}.${price ? ` Then Premium at ${price}, renewing automatically.` : ''}`}>
      <Ring fraction={fractionLeft} color={tone} track={glassBorder(0.14)} />
      <View style={styles.copy}>
        <Text style={[styles.headline, { color: c.text }]}>{headline}</Text>
        <Text style={[styles.line, { color: c.textMuted }]}>Ends {when}</Text>
        <Text style={[styles.line, { color: c.textSubtle }]}>
          {price ? `Then Premium · ${price}, renews automatically. ` : 'Then Premium renews automatically. '}
          <Text
            style={[styles.manage, { color: c.textMuted }]}
            onPress={() => void Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
            accessibilityRole="link">
            Manage
          </Text>
        </Text>
      </View>
      <Pressable
        onPress={() => void Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
        hitSlop={10}
        accessibilityLabel="Manage subscription">
        <MaterialIcons name="chevron-right" size={20} color={c.textSubtle} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  copy: { flex: 1, gap: 2 },
  headline: { fontSize: 16, fontWeight: '800' },
  line: { fontSize: 13, lineHeight: 18 },
  manage: { fontWeight: '700', textDecorationLine: 'underline' },
});
