// Deno Edge Function — Revision G §3: one-transaction member-invite redeem.
// Role is read from the stored token only. A client `role` field is ignored.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

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

function mapError(message: string) {
  if (message.includes('INVITE_USED')) {
    return json({ error: 'This invite has already been used.' }, 409);
  }
  if (message.includes('INVITE_EXPIRED') || message.includes('INVITE_REVOKED')) {
    return json({ error: 'This invite has expired. Ask an admin for a new one.' }, 410);
  }
  if (message.includes('INVITE_MEMBER_GONE')) {
    return json({ error: 'This invite is no longer valid. Ask an admin for a new one.' }, 410);
  }
  if (message.includes('INVITE_OTHER_HOUSEHOLD')) {
    return json({ error: 'This account already belongs to another household.' }, 409);
  }
  if (message.includes('INVITE_ADMIN_CAP')) {
    return json(
      { error: 'Only two admins per household. Ask the owner to demote someone first.' },
      409
    );
  }
  if (message.includes('Unauthorized')) {
    return json({ error: 'Unauthorized' }, 401);
  }
  return json({ error: 'This invite is no longer valid. Ask an admin for a new one.' }, 400);
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

    const body = await req.json().catch(() => ({}));
    // Ignore body.role — token role is server-side only (A2.1 / A2.2).
    void body.role;
    const token = String(body.token ?? '').trim();
    if (!token) {
      return json({ error: 'This invite is no longer valid. Ask an admin for a new one.' }, 400);
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
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { data, error } = await userClient.rpc('redeem_member_invite', { p_token: token });
    if (error) {
      return mapError(error.message ?? '');
    }

    const payload = (data ?? {}) as {
      ok?: boolean;
      householdId?: string;
      memberId?: string;
      role?: string;
      memberStatus?: string;
      householdName?: string;
      sidekickGroceryAdd?: boolean;
      dailyDeadline?: string | null;
      rewardModel?: string | null;
      alreadyMember?: boolean;
    };

    if (!payload.ok || !payload.householdId || !payload.memberId) {
      return json({ error: 'This invite is no longer valid. Ask an admin for a new one.' }, 400);
    }

    const householdId = payload.householdId;
    const memberId = payload.memberId;
    const isSidekick = payload.role === 'sidekick';

    const [{ data: member }, { data: household }, { data: tasks }, { data: members }] = await Promise.all([
      admin.from('household_members').select('*').eq('id', memberId).maybeSingle(),
      admin.from('households').select('*').eq('id', householdId).maybeSingle(),
      admin.from('tasks').select('*').eq('household_id', householdId),
      admin.from('household_members').select('*').eq('household_id', householdId),
    ]);

    const { data: openProposal } = await admin
      .from('reward_proposals')
      .select('id, created_at')
      .eq('member_id', memberId)
      .eq('status', 'open')
      .maybeSingle();

    const bootstrap = {
      member: {
        id: memberId,
        displayName: member?.display_name ?? 'Member',
        role: payload.role,
        status: payload.memberStatus,
        avatar: member?.avatar_symbol ?? (member?.display_name ?? 'M').charAt(0),
      },
      household: {
        id: householdId,
        name: household?.name ?? payload.householdName ?? 'Household',
        dailyDeadline: household?.daily_deadline ?? payload.dailyDeadline ?? null,
        rewardModel: household?.reward_model ?? payload.rewardModel ?? null,
        sidekickGroceryAdd: Boolean(household?.sidekick_grocery_add ?? payload.sidekickGroceryAdd),
      },
      todaysTasks: tasks ?? [],
      members: members ?? [],
      todaysHomework: [],
      xpTotal: member?.xp ?? 0,
      streak: member?.streak ?? 0,
      houseRulesMode: isSidekick ? 'sidekick' : 'adult',
      proposalEligibility: {
        canPropose: !openProposal && isSidekick,
        hasOpenProposal: Boolean(openProposal),
      },
      alreadyMember: Boolean(payload.alreadyMember),
    };

    return json({ ok: true, bootstrap });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return mapError(message);
  }
});
