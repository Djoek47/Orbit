/**
 * Public kid-code lookup (no email). Ghost child profiles live on household_members
 * without a user_id; the code is how a device embodies them.
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
    if (!code) {
      return new Response(JSON.stringify({ error: 'code required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const suffix = code.replace(/^(CMX|ORBIT)-/, '');
    if (/^\d{3,8}$/.test(suffix)) {
      return new Response(
        JSON.stringify({
          error: 'household_invite',
          message: `${code} is a household invite, not a kid code.`,
        }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
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

    const { data: household } = await admin
      .from('households')
      .select('id, name')
      .eq('id', member.household_id)
      .maybeSingle();

    const { data: shells } = await admin
      .from('household_members')
      .select('id, display_name, shared_with_member_ids')
      .eq('household_id', member.household_id)
      .eq('role', 'shared-device')
      .eq('status', 'active');

    const shell = (shells ?? []).find((candidate) => {
      const ids = Array.isArray(candidate.shared_with_member_ids)
        ? (candidate.shared_with_member_ids as string[])
        : [];
      return ids.includes(member.id);
    });
    const onSharedShell = Boolean(shell);

    // The device this person is on, and who else is: names only. This endpoint is public, so it
    // never hands out anyone else's code — those travel only in the device's own QR, which an
    // admin chooses to show.
    let sharedDevice: {
      id: string;
      name: string;
      people: { id: string; name: string; avatar: string | null }[];
    } | null = null;
    if (shell) {
      const ids = (shell.shared_with_member_ids as string[]).slice(0, 6);
      const { data: people } = await admin
        .from('household_members')
        .select('id, display_name, avatar_symbol, status')
        .eq('household_id', member.household_id)
        .in('id', ids);
      sharedDevice = {
        id: shell.id as string,
        name: (shell.display_name as string | null) ?? 'Shared device',
        people: ids
          .map((id) => (people ?? []).find((p) => p.id === id))
          .filter((p): p is NonNullable<typeof p> => p?.status === 'active' || p?.status === 'invited')
          .map((p) => ({
            id: p.id as string,
            name: (p.display_name as string | null) ?? '',
            avatar: (p.avatar_symbol as string | null) ?? null,
          })),
      };
    }

    return new Response(
      JSON.stringify({
        member,
        householdId: member.household_id,
        householdName: household?.name ?? 'Household',
        onSharedShell,
        sharedDevice,
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
