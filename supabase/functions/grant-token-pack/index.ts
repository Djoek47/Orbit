/**
 * Grant consumable token pack after client validates the StoreKit purchase.
 * Unique transaction_id is the replay guard.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PACK_TOKENS: Record<string, number> = {
  small: 200,
  medium: 600,
  large: 1500,
};

const PACK_PRODUCTS: Record<string, string> = {
  small: 'app.choremaxx.household.premium.tokens.small',
  medium: 'app.choremaxx.household.premium.tokens.medium',
  large: 'app.choremaxx.household.premium.tokens.large',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const householdId = typeof body.householdId === 'string' ? body.householdId : null;
    const pack = typeof body.pack === 'string' ? body.pack : null;
    const transactionId = typeof body.transactionId === 'string' ? body.transactionId : null;
    const productId = typeof body.productId === 'string' ? body.productId : null;

    if (!householdId || !pack || !transactionId) {
      return new Response(JSON.stringify({ error: 'invalid_body' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!(pack in PACK_TOKENS)) {
      return new Response(JSON.stringify({ error: 'unknown_pack' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (productId && PACK_PRODUCTS[pack] !== productId) {
      return new Response(JSON.stringify({ error: 'product_mismatch' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const tokens = PACK_TOKENS[pack]!;
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Replay-safe: unique transaction_id
    const { data: existing } = await admin
      .from('token_grants')
      .select('id, household_id, pack, tokens, consumed, transaction_id, granted_at')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          ok: true,
          replay: true,
          grant: {
            id: existing.id,
            householdId: existing.household_id,
            pack: existing.pack,
            tokens: existing.tokens,
            consumed: existing.consumed,
            transactionId: existing.transaction_id,
            grantedAt: existing.granted_at,
          },
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const { data: inserted, error } = await admin
      .from('token_grants')
      .insert({
        household_id: householdId,
        pack,
        tokens,
        consumed: 0,
        transaction_id: transactionId,
      })
      .select('id, household_id, pack, tokens, consumed, transaction_id, granted_at')
      .single();

    if (error || !inserted) {
      // Unique race — return existing
      if (String(error?.code) === '23505') {
        const { data: again } = await admin
          .from('token_grants')
          .select('id, household_id, pack, tokens, consumed, transaction_id, granted_at')
          .eq('transaction_id', transactionId)
          .maybeSingle();
        if (again) {
          return new Response(
            JSON.stringify({
              ok: true,
              replay: true,
              grant: {
                id: again.id,
                householdId: again.household_id,
                pack: again.pack,
                tokens: again.tokens,
                consumed: again.consumed,
                transactionId: again.transaction_id,
                grantedAt: again.granted_at,
              },
            }),
            { headers: { ...cors, 'Content-Type': 'application/json' } }
          );
        }
      }
      return new Response(JSON.stringify({ error: error?.message ?? 'insert_failed' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        grant: {
          id: inserted.id,
          householdId: inserted.household_id,
          pack: inserted.pack,
          tokens: inserted.tokens,
          consumed: inserted.consumed,
          transactionId: inserted.transaction_id,
          grantedAt: inserted.granted_at,
        },
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
