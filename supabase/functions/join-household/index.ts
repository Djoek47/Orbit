// Deno Edge Function — validate invite code and create membership.
// Never overwrite an existing owner/admin/active row (own-invite loop).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { inviteCode, displayName, memberId } = await req.json();
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const code = String(inviteCode ?? '')
      .trim()
      .toUpperCase();
    const resolvedName = String(displayName ?? user.email?.split('@')[0] ?? 'Member').trim();

    const { data: invite, error: inviteError } = await admin
      .from('household_invites')
      .select('*')
      .eq('invite_code', code)
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: 'Invalid invite code' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Invite expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (invite.max_uses != null && invite.max_uses > 0 && (invite.uses ?? 0) >= invite.max_uses) {
      return new Response(JSON.stringify({ error: 'Invite code has reached its use limit' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: householdRow } = await admin
      .from('households')
      .select('join_approval_required')
      .eq('id', invite.household_id)
      .maybeSingle();

    const approvalRequired = householdRow?.join_approval_required !== false;
    const nextStatus = approvalRequired ? 'pending' : 'active';

    const { data: otherHomes } = await admin
      .from('household_members')
      .select('household_id, role, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .neq('household_id', invite.household_id);

    const hasOwnHousehold = (otherHomes ?? []).some((row) => row.role === 'owner' || row.role === 'admin');
    const joinRole = hasOwnHousehold ? 'guest' : 'adult';

    const { data: existing } = await admin
      .from('household_members')
      .select('*')
      .eq('household_id', invite.household_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing && existing.status !== 'removed') {
      return new Response(
        JSON.stringify({
          member: existing,
          householdId: invite.household_id,
          alreadyMember: existing.status === 'active',
          alreadyPending: existing.status === 'pending' || existing.status === 'invited',
          joinApprovalRequired: approvalRequired,
          hasOwnHousehold,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claimMemberId = memberId ? String(memberId).trim() : '';
    if (claimMemberId) {
      const { data: seat, error: seatError } = await admin
        .from('household_members')
        .select('*')
        .eq('id', claimMemberId)
        .eq('household_id', invite.household_id)
        .eq('status', 'invited')
        .maybeSingle();

      if (!seatError && seat) {
        const seatRole = seat.role === 'admin' ? 'admin' : joinRole === 'guest' ? 'guest' : seat.role ?? 'adult';
        const seatNextStatus =
          approvalRequired && seat.join_pre_approved !== true ? 'pending' : 'active';
        const { data: claimed, error: claimError } = await admin
          .from('household_members')
          .update({
            user_id: user.id,
            display_name: resolvedName || seat.display_name,
            role: seatRole,
            status: seatNextStatus,
            avatar_symbol: (resolvedName || seat.display_name || 'M').charAt(0).toUpperCase(),
          })
          .eq('id', seat.id)
          .select('*')
          .single();

        if (claimError || !claimed) {
          return new Response(JSON.stringify({ error: claimError?.message ?? 'Join failed' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await admin
          .from('household_invites')
          .update({ uses: (invite.uses ?? 0) + 1 })
          .eq('id', invite.id);

        if (seatNextStatus === 'pending') {
          await notifyAdminsJoinRequest(admin, invite.household_id, resolvedName || seat.display_name);
        }

        return new Response(
          JSON.stringify({
            member: claimed,
            householdId: invite.household_id,
            joinApprovalRequired: approvalRequired,
            hasOwnHousehold,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const row = {
      household_id: invite.household_id,
      user_id: user.id,
      display_name: resolvedName,
      role: joinRole,
      status: nextStatus,
      avatar_symbol: resolvedName.charAt(0).toUpperCase(),
    };

    const { data: member, error: memberError } = existing
      ? await admin.from('household_members').update(row).eq('id', existing.id).select('*').single()
      : await admin.from('household_members').insert(row).select('*').single();

    if (memberError || !member) {
      return new Response(JSON.stringify({ error: memberError?.message ?? 'Join failed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin
      .from('household_invites')
      .update({ uses: (invite.uses ?? 0) + 1 })
      .eq('id', invite.id);

    if (nextStatus === 'pending') {
      await notifyAdminsJoinRequest(admin, invite.household_id, resolvedName);
    }

    return new Response(
      JSON.stringify({
        member,
        householdId: invite.household_id,
        joinApprovalRequired: approvalRequired,
        hasOwnHousehold,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function notifyAdminsJoinRequest(
  admin: ReturnType<typeof createClient>,
  householdId: string,
  requesterName: string
) {
  const { data: admins } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .in('role', ['owner', 'admin'])
    .eq('status', 'active')
    .not('user_id', 'is', null);

  const title = 'Poppins · Members';
  const body = `${requesterName} asked to join this household.`;
  for (const adminRow of admins ?? []) {
    if (!adminRow.user_id) continue;
    await admin.from('notifications').insert({
      household_id: householdId,
      user_id: adminRow.user_id,
      title,
      body,
      category: 'general',
      priority: 'high',
      data: { surface: 'members' },
      is_read: false,
    });
  }
}
