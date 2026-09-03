/**
 * Dispatch Expo push notifications to household members by audienceMemberIds.
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
  data?: Record<string, unknown>;
};

function audienceMemberIds(data: unknown): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const ids = (data as Record<string, unknown>).audienceMemberIds;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (!messages.length) return;

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

  if (!response.ok) {
    const text = await response.text();
    console.warn('dispatch-member-push expo error', response.status, text);
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

    if (notificationId) {
      const { data: row, error } = await admin
        .from('notifications')
        .select('title, body, data, category')
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
      memberIds = audienceMemberIds(row.data);
    }

    if (!memberIds.length || !title) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no_audience' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
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

    const messages: ExpoPushMessage[] = [...tokens].map((token) => ({
      to: token,
      title,
      body: pushBody,
      sound: 'default',
      priority: 'high',
      data,
    }));

    await sendExpoPush(messages);

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
