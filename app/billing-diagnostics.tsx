/**
 * Purchase diagnostics — the sandbox test bench.
 *
 * Everything the app knows about payments on this phone, on one screen, so a sandbox run can be
 * checked against what should have happened instead of guessed at:
 *
 *   Store       which of the 5 products StoreKit returned, and their storefront prices.
 *               All five missing = App Store Connect isn't ready (agreement, metadata, or the
 *               products aren't attached to the version) — not a code problem.
 *   This phone  the Apple ID's own subscription: plan, trial, expiry, renewal, billing retry.
 *   Household   what the household row says — what Sidekick phones and tablets go by.
 *   Access      the decision the app made from both: paid / trial / locked, days left.
 *   Credits     bought actions left, and this month's allowance.
 *
 * Owners and admins only. Reached from Settings → My Subscription → Purchase diagnostics.
 */
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/orbit/app-text';
import { SettingsModalChrome } from '@/components/orbit/settings/modal-chrome';
import { useAccess } from '@/lib/billing/access-provider';
import {
  currentStoreEnvironment,
  fetchEntitlement,
  fetchRenewalState,
  isTrialEligible,
  latestStoreKitPurchase,
  probeStoreProducts,
  restorePurchases,
  syncHouseholdEntitlement,
  type RenewalState,
  type StoreProbe,
} from '@/lib/billing/iap';
import { openManageSubscriptions } from '@/lib/billing/manage-subscriptions';
import { loadTokenGrants, topUpBalanceFromGrants } from '@/lib/billing/token-grants';
import type { EntitlementState } from '@/constants/billing';
import { useOrbitColors } from '@/lib/theme/use-orbit-colors';
import { useOrbit } from '@/store/orbit-store';

type Snapshot = {
  at: string;
  probe: StoreProbe;
  device: EntitlementState;
  renewal: RenewalState;
  eligible: { monthly: boolean; yearly: boolean };
  environment: string | null;
  bought: number;
};

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function BillingDiagnosticsScreen() {
  const insets = useSafeAreaInsets();
  const { c, glass, glassBorder } = useOrbitColors();
  const { household, currentMember } = useOrbit();
  const access = useAccess();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [probe, device, renewal, monthly, yearly, grants] = await Promise.all([
      probeStoreProducts(),
      fetchEntitlement(),
      fetchRenewalState(),
      isTrialEligible('monthly').catch(() => true),
      isTrialEligible('yearly').catch(() => true),
      loadTokenGrants(household.id).catch(() => []),
    ]);
    setSnap({
      at: new Date().toISOString(),
      probe,
      device,
      renewal,
      eligible: { monthly, yearly },
      environment: currentStoreEnvironment(),
      bought: topUpBalanceFromGrants(grants),
    });
  }, [household.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setNote(null);
    try {
      setNote(await fn());
    } catch (err) {
      setNote(`${label} failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      await access.refresh();
      await load();
      setBusy(null);
    }
  };

  if (currentMember && currentMember.role !== 'owner' && currentMember.role !== 'admin') {
    return <Redirect href={'/(tabs)' as never} />;
  }

  const ok = (good: boolean) => (good ? '#3BB273' : '#E5484D');
  const Row = ({ k, v, good }: { k: string; v: string; good?: boolean }) => (
    <View style={[styles.row, { borderBottomColor: glassBorder(0.08) }]}>
      <Text style={[styles.k, { color: c.textMuted }]}>{k}</Text>
      <Text style={[styles.v, { color: good === undefined ? c.text : ok(good) }]} selectable>
        {v}
      </Text>
    </View>
  );
  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={[styles.card, { backgroundColor: glass(0.05), borderColor: glassBorder(0.12) }]}>
      <Text style={[styles.cardTitle, { color: c.textMuted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
  const Action = ({ label, icon, onPress }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      disabled={busy != null}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: glass(0.06), borderColor: glassBorder(0.14), opacity: pressed || busy ? 0.6 : 1 },
      ]}>
      <MaterialIcons name={icon} size={18} color={c.primary} />
      <Text style={[styles.actionText, { color: c.text }]}>{busy === label ? 'Working…' : label}</Text>
    </Pressable>
  );

  const p = household.premium;
  const allFound = snap ? snap.probe.missing.length === 0 : false;

  return (
    <SettingsModalChrome
      backLabel="Subscription"
      title="Purchase diagnostics"
      purpose="What StoreKit, this phone and the household say — for sandbox testing.">
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
        {!snap ? (
          <Text style={{ color: c.textMuted }}>Reading StoreKit…</Text>
        ) : (
          <>
            <View style={[styles.banner, { backgroundColor: snap.environment === 'Production' ? '#3BB27322' : '#E9A23B22' }]}>
              <Text style={[styles.bannerText, { color: c.text }]}>
                Environment: {snap.environment ?? (snap.probe.native ? 'Sandbox (TestFlight) — no active transaction yet' : 'No StoreKit')}
              </Text>
            </View>

            <Card title="Store products">
              {snap.probe.error ? <Row k="Error" v={snap.probe.error} good={false} /> : null}
              {[...Object.keys(snap.probe.found), ...snap.probe.missing].map((id) => (
                <Row
                  key={id}
                  k={id.replace('app.choremaxx.household.premium.', '')}
                  v={snap.probe.found[id] ? `✓ ${snap.probe.found[id]}` : '✗ not returned'}
                  good={Boolean(snap.probe.found[id])}
                />
              ))}
              {!allFound ? (
                <Text style={[styles.hint, { color: c.textMuted }]}>
                  Missing products are an App Store Connect issue: Paid Apps agreement active, each
                  product Ready to Submit with a price, name and review screenshot, and added to the
                  version. New products can take an hour to reach the sandbox.
                </Text>
              ) : null}
            </Card>

            <Card title="This phone's Apple ID">
              <Row k="Active" v={snap.device.active ? 'Yes' : 'No'} good={snap.device.active} />
              <Row k="Plan" v={snap.device.productId?.split('.').pop() ?? '—'} />
              <Row k="Free trial" v={snap.device.inTrial ? 'Yes' : 'No'} />
              <Row k="Period ends" v={when(snap.device.expiresAt)} />
              <Row k="Will renew" v={snap.renewal.willRenew === null ? 'Unknown' : snap.renewal.willRenew ? 'Yes' : 'No — cancelled'} />
              <Row k="Billing retry" v={snap.renewal.billingIssue ? `Yes · grace until ${when(snap.renewal.graceEndsAt)}` : 'No'} good={!snap.renewal.billingIssue} />
              <Row k="Trial eligible" v={`monthly ${snap.eligible.monthly ? 'yes' : 'no'} · yearly ${snap.eligible.yearly ? 'yes' : 'no'}`} />
            </Card>

            <Card title="Household record">
              <Row k="Plan" v={p?.productId?.split('.').pop() ?? 'Never recorded'} />
              <Row k="Free trial" v={p?.expiresAt ? (p.inTrial ? 'Yes' : 'No') : '—'} />
              <Row k="Ends" v={when(p?.expiresAt)} />
              <Row k="Will renew" v={p?.willRenew === null || p?.willRenew === undefined ? 'Unknown' : p.willRenew ? 'Yes' : 'No'} />
              <Row k="Environment" v={p?.environment ?? '—'} />
              <Row k="Last reported" v={when(p?.updatedAt)} />
            </Card>

            <Card title="What the app decided">
              <Row k="Access" v={access.view.level} good={access.view.level !== 'locked'} />
              <Row k="App locked" v={access.view.appLocked ? 'Yes' : 'No'} good={!access.view.appLocked} />
              <Row k="Trial label" v={access.view.trialLabel || '—'} />
              <Row k="Monthly Poppins" v={String(access.view.monthlyAllowance)} />
              <Row k="Bought actions left" v={String(snap.bought)} />
              <Row k="Read at" v={when(snap.at)} />
            </Card>

            {note ? <Text style={[styles.note, { color: c.text }]}>{note}</Text> : null}

            <View style={styles.actions}>
              <Action label="Refresh" icon="refresh" onPress={() => void run('Refresh', async () => 'Read again.')} />
              <Action
                label="Restore purchases"
                icon="restore"
                onPress={() =>
                  void run('Restore purchases', async () => {
                    const next = await restorePurchases();
                    return next.active ? 'Restored an active subscription.' : 'Nothing active on this Apple ID.';
                  })
                }
              />
              <Action
                label="Report to household"
                icon="sync"
                onPress={() =>
                  void run('Report to household', async () => {
                    const purchase = latestStoreKitPurchase();
                    if (!purchase) return 'No StoreKit subscription on this phone to report.';
                    return `Household sync: ${await syncHouseholdEntitlement(household.id, purchase)}`;
                  })
                }
              />
              <Action
                label="Apple subscriptions"
                icon="open-in-new"
                onPress={() => void run('Apple subscriptions', async () => {
                  await openManageSubscriptions();
                  return 'Back from Apple — status re-read.';
                })}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SettingsModalChrome>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingHorizontal: 20, paddingTop: 8 },
  banner: { borderRadius: 12, padding: 12 },
  bannerText: { fontSize: 14, fontWeight: '700' },
  card: { borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  cardTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginBottom: 4 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 10, justifyContent: 'space-between', paddingVertical: 8 },
  k: { flexShrink: 0, fontSize: 13.5 },
  v: { flex: 1, fontSize: 13.5, fontWeight: '600', textAlign: 'right' },
  hint: { fontSize: 12.5, lineHeight: 17, marginTop: 8 },
  note: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { alignItems: 'center', borderRadius: 999, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 42, paddingHorizontal: 14 },
  actionText: { fontSize: 14, fontWeight: '600' },
});
