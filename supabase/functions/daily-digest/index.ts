/**
 * Deno Edge Function — the daily digest, sent by cron.
 *
 * pg_cron calls this once an hour with no body. Every household whose local clock has just
 * struck 8am or 6pm gets a pass: one notification per active member, built from that
 * household's own rows (no model, no per-household cost), then handed to dispatch-member-push,
 * which applies the household's notification settings and the subscription gate.
 *
 * Service role only. Deploy with --no-verify-jwt.
 *
 * Idempotent: a household's digest is written once per local day per slot. A cron tick that
 * repeats, or an hour that fires twice over a DST change, sends nothing the second time.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import {
  buildDigest,
  localDay,
  localHour,
  slotForHour,
  type DigestSlot,
  type DigestTask,
} from '../_shared/daily-digest.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

function isService(req: Request): boolean {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return Boolean(key) && req.headers.get('Authorization') === `Bearer ${key}`;
}

type Household = { id: string; timezone: string | null };

async function sendHouseholdDigest(
  admin: ReturnType<typeof serviceClient>,
  household: Household,
  slot: DigestSlot,
  now: Date
): Promise<{ householdId: string; sent: number; reason?: string }> {
  const timezone = household.timezone?.trim() || 'UTC';
  const day = localDay(now, timezone);
  const digestKey = `${day}:${slot}`;

  // Already sent for this local day and slot?
  const { data: existing } = await admin
    .from('notifications')
    .select('id')
    .eq('household_id', household.id)
    .eq('category', 'tasks')
    .contains('data', { kind: 'dailyDigest', digestKey })
    .limit(1);
  if (existing && existing.length > 0) {
    return { householdId: household.id, sent: 0, reason: 'already_sent' };
  }

  const [{ data: members }, { data: tasks }] = await Promise.all([
    admin
      .from('household_members')
      .select('id, display_name')
      .eq('household_id', household.id)
      .eq('status', 'active'),
    admin
      .from('tasks')
      .select('id, title, status, due_at, assignee_member_id')
      .eq('household_id', household.id)
      .not('due_at', 'is', null),
  ]);

  const people = (members ?? []).map((m) => ({
    memberId: m.id as string,
    name: (m.display_name as string | null)?.trim() || 'there',
  }));
  if (people.length === 0) {
    return { householdId: household.id, sent: 0, reason: 'no_members' };
  }

  const digestTasks: DigestTask[] = (tasks ?? []).map((t) => ({
    id: t.id as string,
    title: (t.title as string) ?? '',
    status: (t.status as string) ?? 'pending',
    dueAt: (t.due_at as string | null) ?? null,
    assigneeMemberId: (t.assignee_member_id as string | null) ?? null,
  }));

  const messages = buildDigest({ slot, people, tasks: digestTasks, timezone, now });
  if (messages.length === 0) {
    return { householdId: household.id, sent: 0, reason: 'nothing_to_say' };
  }

  const rows = messages.map((m) => ({
    household_id: household.id,
    title: m.title,
    body: m.body,
    category: 'tasks',
    priority: 'low',
    data: {
      kind: 'dailyDigest',
      digestKey,
      slot,
      audienceMemberIds: [m.memberId],
      taskIds: m.taskIds,
    },
  }));

  const { data: inserted, error } = await admin.from('notifications').insert(rows).select('id');
  if (error) {
    console.warn('daily-digest insert failed', household.id, error.message);
    return { householdId: household.id, sent: 0, reason: 'insert_failed' };
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  let sent = 0;
  for (const row of inserted ?? []) {
    try {
      const res = await fetch(`${url}/functions/v1/dispatch-member-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ notificationId: row.id }),
      });
      if (res.ok) sent += 1;
      else console.warn('daily-digest push failed', row.id, res.status);
    } catch (pushError) {
      console.warn('daily-digest push threw', row.id, pushError);
    }
  }

  return { householdId: household.id, sent };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!isService(req)) return json({ error: 'service role required' }, 401);

  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const now = typeof body.now === 'string' ? new Date(body.now) : new Date();
    // A single household can be forced through for testing; cron passes neither.
    const onlyHousehold = typeof body.householdId === 'string' ? body.householdId : null;
    const forcedSlot = body.slot === 'morning' || body.slot === 'evening' ? body.slot : null;

    const admin = serviceClient();
    let query = admin.from('households').select('id, timezone');
    if (onlyHousehold) query = query.eq('id', onlyHousehold);
    const { data: households, error } = await query;
    if (error) return json({ error: error.message }, 500);

    const results: Array<{ householdId: string; sent: number; reason?: string }> = [];
    for (const household of (households ?? []) as Household[]) {
      const timezone = household.timezone?.trim() || 'UTC';
      const slot = forcedSlot ?? slotForHour(localHour(now, timezone));
      if (!slot) continue;
      results.push(await sendHouseholdDigest(admin, household, slot, now));
    }

    return json({
      ok: true,
      households: results.length,
      sent: results.reduce((n, r) => n + r.sent, 0),
      results,
    });
  } catch (error) {
    console.error('daily-digest failed', error);
    return json({ error: error instanceof Error ? error.message : 'unknown' }, 500);
  }
});
