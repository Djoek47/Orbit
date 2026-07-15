// Deno Edge Function — validate invite code and create pending membership.

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

    const { inviteCode, displayName } = await req.json();
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

    const { data: member, error: memberError } = await admin
      .from('household_members')
      .upsert(
        {
          household_id: invite.household_id,
          user_id: user.id,
          display_name: displayName ?? user.email?.split('@')[0] ?? 'Member',
          role: 'adult',
          status: 'pending',
          avatar_symbol: (displayName ?? 'M').charAt(0).toUpperCase(),
        },
        { onConflict: 'household_id,user_id' }
      )
      .select('*')
      .single();

    if (memberError) {
      return new Response(JSON.stringify({ error: memberError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin
      .from('household_invites')
      .update({ uses: (invite.uses ?? 0) + 1 })
      .eq('id', invite.id);

    return new Response(JSON.stringify({ member, householdId: invite.household_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
