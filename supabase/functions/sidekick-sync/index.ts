/**
 * Sidekick household sync — profile-code auth for kid devices without Supabase JWT.
 * Returns tasks, members, and member-targeted notifications for polling / refresh.
 * Expires open tasks past 23:59 before returning (service role persist).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { expireOpenDbTasksAtBoundary, type DbTaskRow } from '../_shared/task-expiry.ts';

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

function notificationForMember(
  row: { data?: unknown },
  memberId: string
): boolean {
  const data =
    row.data && typeof row.data === 'object' && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : {};
  if (data.dismissed === true) return false;
  const dismissedBy = data.dismissedByMemberIds;
  if (Array.isArray(dismissedBy) && dismissedBy.some((id) => id === memberId)) {
    return false;
  }
  const audienceIds = data.audienceMemberIds;
  if (Array.isArray(audienceIds) && audienceIds.length > 0) {
    return audienceIds.some((id) => id === memberId);
  }
  const roles = data.audienceRoles;
  if (Array.isArray(roles) && roles.length > 0) {
    return roles.some((role) => role === 'child');
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const code = normalizeCode(String(body.code ?? ''));
    if (!code) {
      return new Response(JSON.stringify({ error: 'code required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: member, error: memberError } = await admin
      .from('household_members')
      .select('*')
      .eq('profile_invite_code', code)
      .in('status', ['invited', 'active'])
      .maybeSingle();

    if (memberError || !member) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const householdId = member.household_id;
    const memberId = member.id;
    const seenAt = new Date().toISOString();

    await admin
      .from('household_members')
      .update({ last_seen_at: seenAt })
      .eq('id', memberId);

    const [
      { data: household },
      { data: members },
      { data: tasks },
      { data: notifications },
      { data: rewards },
      { data: redemptions },
      { data: groceries },
      { data: calendarEvents },
      { data: customHouseRules },
      { data: recessPeriods },
    ] = await Promise.all([
      admin.from('households').select('*').eq('id', householdId).maybeSingle(),
      admin.from('household_members').select('*').eq('household_id', householdId),
      admin
        .from('tasks')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false }),
      admin
        .from('notifications')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(80),
      admin.from('rewards').select('*').eq('household_id', householdId),
      admin
        .from('reward_redemptions')
        .select('*')
        .eq('household_id', householdId)
        .order('requested_at', { ascending: false }),
      admin
        .from('grocery_items')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false }),
      admin
        .from('calendar_events')
        .select('*')
        .eq('household_id', householdId)
        .order('starts_at', { ascending: true }),
      admin
        .from('custom_house_rules')
        .select('id, body, sort_order')
        .eq('household_id', householdId)
        .order('sort_order', { ascending: true }),
      admin
        .from('recess_periods')
        .select('member_id, start_date, end_date')
        .eq('household_id', householdId),
    ]);

    const now = new Date();
    const taskRows = (tasks ?? []) as DbTaskRow[];
    const { expired: toExpire } = expireOpenDbTasksAtBoundary(taskRows, now, {
      members: members ?? [],
      recessPeriods: recessPeriods ?? [],
    });

    if (toExpire.length > 0) {
      await Promise.all(
        toExpire.map((row) =>
          admin
            .from('tasks')
            .update({ status: 'expired', expired_at: row.expired_at })
            .eq('id', row.id)
        )
      );
      const expiredIds = new Set(toExpire.map((row) => row.id));
      for (const row of taskRows) {
        if (expiredIds.has(row.id)) {
          const patch = toExpire.find((item) => item.id === row.id);
          if (patch) {
            row.status = patch.status;
            row.expired_at = patch.expired_at;
          }
        }
      }
    }

    const visibleNotifications = (notifications ?? []).filter((row) =>
      notificationForMember(row, memberId)
    );

    return new Response(
      JSON.stringify({
        member: { ...member, last_seen_at: seenAt },
        household,
        members: members ?? [],
        tasks: tasks ?? [],
        notifications: visibleNotifications,
        rewards: rewards ?? [],
        redemptions: redemptions ?? [],
        groceries: groceries ?? [],
        calendarEvents: calendarEvents ?? [],
        customHouseRules: customHouseRules ?? [],
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
