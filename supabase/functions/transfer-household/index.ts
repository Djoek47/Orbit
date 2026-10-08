/**
 * Household ownership transfer — create QR token or accept scanned token.
 *
 * Deploy: npx supabase functions deploy transfer-household
 *
 * Body:
 *   { action: 'create', householdId }
 *   { action: 'accept', token }
 *   { action: 'eligibility' } — check if signed-in user can accept
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function mapCreateError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('only the household owner')) {
    return json({ error: 'Only the household owner can transfer ownership.', code: 'TRANSFER_FORBIDDEN' }, 403);
  }
  if (lower.includes('not authenticated') || lower.includes('unauthorized')) {
    return json({ error: 'Unauthorized', code: 'TRANSFER_UNAUTHORIZED' }, 401);
  }
  if (lower.includes('gen_random_bytes') || lower.includes('does not exist')) {
    return json(
      {
        error: 'Transfer isn’t ready on this server yet. Try again after an update.',
        code: 'TRANSFER_CREATE_FAILED',
      },
      500
    );
  }
  return json(
    { error: 'Could not create the transfer QR. Try again in a moment.', code: 'TRANSFER_CREATE_FAILED' },
    400
  );
}

function mapAcceptError(message: string) {
  if (message.includes('TRANSFER_USED')) {
    return json({ error: 'This transfer QR was already used.', code: 'TRANSFER_USED' }, 409);
  }
  if (message.includes('TRANSFER_EXPIRED') || message.includes('TRANSFER_INVALID')) {
    return json({ error: 'This transfer QR expired. Ask the owner for a new one.', code: 'TRANSFER_EXPIRED' }, 410);
  }
  if (message.includes('TRANSFER_NOT_FOUND')) {
    return json({ error: 'This transfer QR was not found.', code: 'TRANSFER_NOT_FOUND' }, 404);
  }
  if (message.includes('TRANSFER_SELF')) {
    return json({ error: 'Scan this QR on a different empty account.', code: 'TRANSFER_SELF' }, 400);
  }
  if (message.includes('TRANSFER_NOT_EMPTY')) {
    return json(
      {
        error:
          'Transfer only works on an empty account — use a new account, or one that only has a household already scheduled for deletion.',
        code: 'not_empty',
      },
      409
    );
  }
  if (message.includes('TRANSFER_OWNER_CHANGED')) {
    return json({ error: 'Ownership changed. Ask the current owner for a new QR.', code: 'TRANSFER_OWNER_CHANGED' }, 409);
  }
  if (message.includes('Unauthorized') || message.includes('Not authenticated')) {
    return json({ error: 'Unauthorized', code: 'TRANSFER_UNAUTHORIZED' }, 401);
  }
  return json({ error: 'Could not complete the transfer.', code: 'TRANSFER_ACCEPT_FAILED' }, 400);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      householdId?: string;
      token?: string;
    };
    const action = (body.action ?? '').trim();

    if (action === 'eligibility') {
      const { data, error } = await userClient.rpc('account_eligible_for_household_transfer', {
        p_user_id: user.id,
      });
      if (error) {
        return json({ error: error.message }, 400);
      }
      return json({ ok: true, eligible: Boolean(data) });
    }

    if (action === 'create') {
      const householdId = (body.householdId ?? '').trim();
      if (!householdId) {
        return json({ error: 'householdId required' }, 400);
      }
      const { data, error } = await userClient.rpc('create_household_transfer_token', {
        p_household_id: householdId,
      });
      if (error) {
        return mapCreateError(error.message || 'TRANSFER_CREATE_FAILED');
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== 'object') {
        return json({ error: 'Could not create transfer QR.' }, 400);
      }
      const record = row as {
        token?: string;
        expires_at?: string;
        household_name?: string;
      };
      return json({
        ok: true,
        token: record.token,
        expiresAt: record.expires_at,
        householdName: record.household_name,
      });
    }

    if (action === 'accept') {
      const token = (body.token ?? '').trim();
      if (!token) {
        return json({ error: 'token required' }, 400);
      }
      const { data, error } = await userClient.rpc('accept_household_transfer', {
        p_token: token,
      });
      if (error) {
        return mapAcceptError(error.message ?? '');
      }
      const payload = (data ?? {}) as {
        ok?: boolean;
        householdId?: string;
        householdName?: string;
        memberId?: string;
        role?: string;
      };
      if (!payload.ok || !payload.householdId) {
        return json({ error: 'Could not complete the transfer.' }, 400);
      }
      return json({
        ok: true,
        householdId: payload.householdId,
        householdName: payload.householdName,
        memberId: payload.memberId,
        role: payload.role ?? 'owner',
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('transfer-household', error);
    return json({ error: 'Could not complete the transfer.' }, 500);
  }
});
