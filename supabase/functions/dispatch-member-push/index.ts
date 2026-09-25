/**
 * Dispatch Expo push notifications to household members by audienceMemberIds.
 * Honours households.notification_prefs (WO9.3 §6.1).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  categoryId?: string;
  data?: Record<string, unknown>;
};

function audienceMemberIds(data: unknown): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const ids = (data as Record<string, unknown>).audienceMemberIds;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/** Map notification category / kind → households.notification_prefs key. */
function prefKeyForCategory(category: unknown, data: Record<string, unknown>): string | null {
  const raw = String(category ?? data.category ?? data.kind ?? '').toLowerCase();
  if (!raw) return null;
  if (raw.includes('task') || raw === 'nudge') return 'tasks';
  if (raw.includes('itinerary') || raw.includes('trip')) return 'itinerary';
  if (raw.includes('grocer') || raw.includes('shop') || raw === 'missingontheway') return 'groceries';
  if (raw.includes('reward') || raw.includes('allowance') || raw.includes('badge')) return 'rewards';
  if (raw.includes('deal')) return 'deals';
  if (raw.includes('plan')) return 'plans';
  if (raw.includes('fair') || raw.includes('xp') || raw.includes('momentum')) return 'xpFairness';
  if (raw.includes('nearshop') || raw === 'near_shop') return 'nearShop';
  return null;
}

function prefsAllow(
  prefs: Record<string, unknown> | null | undefined,
  category: unknown,
  data: Record<string, unknown>
): boolean {
  if (!prefs) return true;
  const key = prefKeyForCategory(category, data);
  if (!key) return true;
  return prefs[key] !== false;
}

type ExpoPushResult = {
  httpStatus: number | null;
  ticketIds: string[];
  errors: string[];
};

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoPushResult> {
  const result: ExpoPushResult = { httpStatus: null, ticketIds: [], errors: [] };
  if (!messages.length) return result;

  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  });
  result.httpStatus = response.status;

  if (!response.ok) {
    const text = await response.text();
    console.warn('dispatch-member-push expo error', response.status, text);
    result.errors.push(`http_${response.status}`);
    return result;
  }

  // Tickets are only used for the activity log — never fail the send on parse.
  try {
    const json = (await response.json()) as {
      data?: { status?: string; id?: string; message?: string }[];
    };
    for (const ticket of json.data ?? []) {
      if (ticket.status === 'ok' && ticket.id) result.ticketIds.push(ticket.id);
      else if (ticket.message) result.errors.push(ticket.message);
    }
  } catch {
    // ignore
  }
  return result;
}

/** Append-only activity log row (see 20260925090000_activity_log.sql). Best-effort. */
async function logPushSent(
  admin: ReturnType<typeof createClient>,
  input: {
    householdId: string;
    notificationId: string;
    title: string;
    body: string;
    category: unknown;
    memberIds: string[];
    detail: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const { error } = await admin.from('activity_log').insert({
      household_id: input.householdId,
      kind: 'notification_push_sent',
      notification_id: input.notificationId,
      member_id: input.memberIds.length === 1 ? input.memberIds[0] : null,
      title: input.title,
      body: input.body,
      category: typeof input.category === 'string' ? input.category : null,
      detail: { audience_member_ids: input.memberIds, ...input.detail },
    });
    if (error) console.warn('dispatch-member-push activity_log', error.message);
  } catch (error) {
    console.warn('dispatch-member-push activity_log', String(error));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const notificationId = typeof body.notificationId === 'string' ? body.notificationId : null;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let title = String(body.title ?? '');
    let pushBody = String(body.body ?? '');
    let data: Record<string, unknown> =
      body.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {};
    let memberIds = Array.isArray(body.audienceMemberIds)
      ? body.audienceMemberIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];
    let category: unknown = body.category ?? data.category ?? null;
    let householdId: string | null =
      typeof body.householdId === 'string'
        ? body.householdId
        : typeof data.householdId === 'string'
          ? data.householdId
          : null;

    if (notificationId) {
      const { data: row, error } = await admin
        .from('notifications')
        .select('title, body, data, category, household_id')
        .eq('id', notificationId)
        .maybeSingle();

      if (error || !row) {
        return new Response(JSON.stringify({ error: 'notification_not_found' }), {
          status: 404,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      title = row.title;
      pushBody = row.body;
      data = {
        ...(row.data && typeof row.data === 'object' && !Array.isArray(row.data)
          ? (row.data as Record<string, unknown>)
          : {}),
        notificationId,
        category: row.category,
      };
      category = row.category;
      householdId =
        typeof (row as { household_id?: string }).household_id === 'string'
          ? (row as { household_id: string }).household_id
          : householdId;
      memberIds = audienceMemberIds(row.data);
    }

    if (!memberIds.length || !title) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no_audience' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!householdId && memberIds[0]) {
      const { data: mem } = await admin
        .from('household_members')
        .select('household_id')
        .eq('id', memberIds[0])
        .maybeSingle();
      if (mem?.household_id) householdId = mem.household_id;
    }

    if (householdId) {
      const { data: hh } = await admin
        .from('households')
        .select('notification_prefs')
        .eq('id', householdId)
        .maybeSingle();
      const prefs = (hh?.notification_prefs ?? null) as Record<string, unknown> | null;
      if (!prefsAllow(prefs, category, data)) {
        if (notificationId) {
          await logPushSent(admin, {
            householdId,
            notificationId,
            title,
            body: pushBody,
            category,
            memberIds,
            detail: { devices: 0, reason: 'prefs_disabled' },
          });
        }
        return new Response(
          JSON.stringify({ ok: true, sent: 0, reason: 'prefs_disabled', category }),
          { headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
    }

    const [{ data: memberTokens }, { data: members }] = await Promise.all([
      admin.from('push_tokens').select('token').in('member_id', memberIds),
      admin
        .from('household_members')
        .select('id, user_id')
        .in('id', memberIds)
        .not('user_id', 'is', null),
    ]);

    const userIds = (members ?? [])
      .map((row) => row.user_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const { data: userTokens } = userIds.length
      ? await admin.from('push_tokens').select('token').in('user_id', userIds)
      : { data: [] as { token: string }[] };

    const tokens = new Set<string>();
    for (const row of memberTokens ?? []) {
      if (row.token) tokens.add(row.token);
    }
    for (const row of userTokens ?? []) {
      if (row.token) tokens.add(row.token);
    }

    const categoryId =
      typeof body.categoryId === 'string'
        ? body.categoryId
        : data.kind === 'iui_act'
          ? 'choremaxx.iui_act'
          : undefined;

    const messages: ExpoPushMessage[] = [...tokens].map((token) => ({
      to: token,
      title,
      body: pushBody,
      sound: 'default',
      priority: 'high',
      ...(categoryId ? { categoryId } : {}),
      data,
    }));

    const push = await sendExpoPush(messages);

    if (notificationId && householdId) {
      await logPushSent(admin, {
        householdId,
        notificationId,
        title,
        body: pushBody,
        category,
        memberIds,
        detail: {
          devices: messages.length,
          ticket_ids: push.ticketIds,
          errors: push.errors,
          http_status: push.httpStatus,
          ...(messages.length === 0 ? { reason: 'no_push_tokens' } : {}),
        },
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: messages.length }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
