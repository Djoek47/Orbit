/**
 * Profile-only join — Sidekick completes name/avatar after scanning CMX-NAME.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^CHOREMAXX-/, 'CMX-')
    .replace(/^(CMX|ORBIT)(?=[A-Z0-9])/, '$1-');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(String(body.code ?? ''));
    const displayName = String(body.displayName ?? '').trim();
    const avatar = String(body.avatar ?? '').trim();

    if (!code) {
      return new Response(JSON.stringify({ error: 'code required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const suffix = code.replace(/^(CMX|ORBIT)-/, '');
    if (/^\d{3,8}$/.test(suffix)) {
      return new Response(JSON.stringify({ error: 'household_invite' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!displayName || displayName.length < 2) {
      return new Response(JSON.stringify({ error: 'displayName required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: member, error } = await admin
      .from('household_members')
      .select('*')
      .eq('profile_invite_code', code)
      .in('status', ['invited', 'active'])
      .maybeSingle();

    if (error || !member) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: householdRow } = await admin
      .from('households')
      .select('join_approval_required, name')
      .eq('id', member.household_id)
      .maybeSingle();

    const approvalRequired = householdRow?.join_approval_required !== false;
    const nextStatus = approvalRequired ? 'pending' : 'active';

    const { data: updated, error: updateError } = await admin
      .from('household_members')
      .update({
        display_name: displayName,
        avatar_symbol: avatar || displayName.charAt(0).toUpperCase(),
        status: nextStatus,
      })
      .eq('id', member.id)
      .select('*')
      .single();

    if (updateError || !updated) {
      return new Response(JSON.stringify({ error: updateError?.message ?? 'update_failed' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (approvalRequired) {
      const { data: admins } = await admin
        .from('household_members')
        .select('user_id')
        .eq('household_id', member.household_id)
        .in('role', ['owner', 'admin'])
        .eq('status', 'active')
        .not('user_id', 'is', null);

      for (const adminRow of admins ?? []) {
        if (!adminRow.user_id) continue;
        await admin.from('notifications').insert({
          household_id: member.household_id,
          user_id: adminRow.user_id,
          title: 'Poppins · Members',
          body: `${displayName} asked to join this household.`,
          category: 'general',
          priority: 'high',
          data: { surface: 'members' },
          is_read: false,
        });
      }
    }

    return new Response(
      JSON.stringify({
        member: updated,
        householdId: member.household_id,
        householdName: householdRow?.name ?? 'Household',
        status: nextStatus,
        joinApprovalRequired: approvalRequired,
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
