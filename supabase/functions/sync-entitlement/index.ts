/**
 * Record a household's subscription, as reported by an admin's device.
 *
 * The subscription is bought on one phone, under one Apple ID, but it pays for the whole house.
 * Sidekick phones and shared tablets can never see that purchase through StoreKit, so the admin
 * device reports it here and the household row carries it to everyone else.
 *
 * Trust model (same as grant-token-pack): authenticated, active owner/admin of the household,
 * product id on the allow-list, expiry within sane bounds, and one Apple subscription per
 * household via a unique original_transaction_id. Signed-transaction verification against the
 * App Store Server API is still to do — see the TODO below — and should land before scale.
 *
 * Only ever moves a household forward: it records an active trial or paid period. It never
 * clears one, because "this phone has no subscription" does not mean "this house has none" —
 * another admin may be the one paying. Lapsing happens on its own when premium_expires_at passes.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Must match IAP_SUBSCRIPTIONS in constants/billing.ts. */
const SUBSCRIPTION_PRODUCTS = new Set([
  'app.choremaxx.household.premium.monthlyv',
  'app.choremaxx.household.premium.yearlyv',
]);

const ENVIRONMENTS = new Set(['Sandbox', 'Production', 'Xcode']);

/** A year plus slack. Anything further out is not a real StoreKit expiry. */
const MAX_AHEAD_MS = 400 * 24 * 60 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const householdId = typeof body.householdId === 'string' ? body.householdId : null;
    const productId = typeof body.productId === 'string' ? body.productId : null;
    const originalTransactionId =
      typeof body.originalTransactionId === 'string' ? body.originalTransactionId.trim() : '';
    const expiresAtMs = typeof body.expiresAtMs === 'number' ? body.expiresAtMs : NaN;
    const inTrial = body.inTrial === true;
    const willRenew = typeof body.willRenew === 'boolean' ? body.willRenew : null;
    const environment =
      typeof body.environment === 'string' && ENVIRONMENTS.has(body.environment)
        ? body.environment
        : null;

    if (!householdId || !productId || !originalTransactionId || !Number.isFinite(expiresAtMs)) {
      return json({ error: 'invalid_body' }, 400);
    }
    if (!SUBSCRIPTION_PRODUCTS.has(productId)) {
      return json({ error: 'unknown_product' }, 400);
    }
    const now = Date.now();
    if (expiresAtMs <= now) {
      // Nothing to record: an expired period is the default state of a row with no Premium.
      return json({ ok: true, ignored: 'already_expired' });
    }
    if (expiresAtMs - now > MAX_AHEAD_MS) {
      return json({ error: 'implausible_expiry' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const { data: membership } = await admin
      .from('household_members')
      .select('role, status')
      .eq('household_id', householdId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership || !['owner', 'admin'].includes(String(membership.role))) {
      return json({ error: 'forbidden' }, 403);
    }

    // TODO(P0 App Store): verify the signed transaction (JWS) against the App Store Server API
    // before trusting originalTransactionId and expiresAtMs. Until then this trusts an
    // authenticated admin, which matches grant-token-pack.

    // One subscription, one household. If this subscription already unlocks another household,
    // it may only move if the same person bought it — e.g. an admin who started a new house.
    const { data: claimed } = await admin
      .from('households')
      .select('id, premium_purchased_by')
      .eq('premium_original_transaction_id', originalTransactionId)
      .maybeSingle();
    const movingFrom = claimed && claimed.id !== householdId ? claimed : null;

    if (movingFrom?.premium_purchased_by && movingFrom.premium_purchased_by !== user.id) {
      return json({ error: 'subscription_claimed' }, 409);
    }

    // Never shorten a different, longer period. Two admins on two Apple IDs can both be paying;
    // a stale report from one phone must not cut the other's time short. Decided before any
    // write, so a refusal here never leaves a subscription detached from both households.
    const { data: current } = await admin
      .from('households')
      .select('premium_expires_at, premium_original_transaction_id')
      .eq('id', householdId)
      .maybeSingle();
    const sameSubscription = current?.premium_original_transaction_id === originalTransactionId;
    const currentMs = current?.premium_expires_at
      ? new Date(current.premium_expires_at).getTime()
      : 0;
    if (!sameSubscription && currentMs > expiresAtMs) {
      return json({ ok: true, ignored: 'shorter_than_current' });
    }

    if (movingFrom) {
      await admin
        .from('households')
        .update({
          premium_product_id: null,
          premium_in_trial: false,
          premium_expires_at: null,
          premium_original_transaction_id: null,
          premium_environment: null,
          premium_purchased_by: null,
          premium_updated_at: new Date().toISOString(),
          premium_will_renew: null,
        })
        .eq('id', movingFrom.id);
    }

    const { data: updated, error } = await admin
      .from('households')
      .update({
        premium_product_id: productId,
        premium_in_trial: inTrial,
        premium_expires_at: new Date(expiresAtMs).toISOString(),
        premium_original_transaction_id: originalTransactionId,
        premium_environment: environment,
        premium_purchased_by: user.id,
        premium_updated_at: new Date().toISOString(),
        premium_will_renew: willRenew,
      })
      .eq('id', householdId)
      .select(
        'premium_product_id, premium_in_trial, premium_expires_at, premium_environment, premium_updated_at, premium_will_renew'
      )
      .maybeSingle();

    if (error || !updated) return json({ error: error?.message ?? 'update_failed' }, 500);
    return json({ ok: true, premium: updated });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
