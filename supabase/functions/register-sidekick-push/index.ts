/**
 * Register Expo push token for Sidekick devices (profile-code auth, no JWT).
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
    const token = String(body.token ?? '').trim();
    const platform = String(body.platform ?? 'unknown').trim();

    if (!code || !token) {
      return new Response(JSON.stringify({ error: 'code and token required' }), {
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
      .select('id, status')
      .eq('profile_invite_code', code)
      .in('status', ['invited', 'active'])
      .maybeSingle();

    if (memberError || !member) {
      return new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { error: upsertError } = await admin.from('push_tokens').upsert(
      {
        member_id: member.id,
        user_id: null,
        token,
        platform,
      },
      { onConflict: 'token' }
    );

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, memberId: member.id }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
