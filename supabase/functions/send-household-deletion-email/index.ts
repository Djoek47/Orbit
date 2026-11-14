/**
 * Household deletion lifecycle emails → Resend.
 *
 * kind: reminder | confirmed | cancelled
 * Reminder stages: 7d | 3d | 24h | 1h11m
 *
 * Secrets: RESEND_API_KEY, RESEND_FROM_EMAIL (optional)
 * Deploy: npx supabase functions deploy send-household-deletion-email
 *
 * Cron dispatch (Stop 3) and recovery UI (Stop 4) call this edge.
 * Admin Settings harness can fire test sends now.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  renderHouseholdDeletionEmail,
  type DeletionEmailKind,
  type DeletionReminderStage,
} from './branded-html.ts';

const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Choremaxx <noreply@choremaxx.app>';
const SUPPORT = 'support@choremaxx.app';

const KINDS = new Set<DeletionEmailKind>(['reminder', 'confirmed', 'cancelled']);
const STAGES = new Set<DeletionReminderStage>(['7d', '3d', '24h', '1h11m']);

type Body = {
  to?: string;
  name?: string;
  kind?: string;
  stage?: string;
  householdName?: string;
  householdId?: string;
  purgeDate?: string;
  recoverUrl?: string;
  optOutUrl?: string;
  confirmBy?: string;
  confirmUrl?: string;
  cancelUrl?: string;
  homeUrl?: string;
};

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      return Response.json(
        { error: 'Deletion email is not configured yet.' },
        { status: 503, headers: corsHeaders(origin) }
      );
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    let userEmail = '';
    let userName = '';
    if (authHeader && supabaseUrl && anon) {
      const supabase = createClient(supabaseUrl, anon, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await supabase.auth.getUser();
      userEmail = data.user?.email ?? '';
      const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
      userName =
        (typeof meta?.full_name === 'string' && meta.full_name) ||
        (typeof meta?.name === 'string' && meta.name) ||
        '';
    }

    const body = (await req.json()) as Body;
    const to = (body.to ?? userEmail).trim();
    if (!to || !to.includes('@')) {
      return Response.json(
        { error: 'No email on file for this message.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const kindRaw = (body.kind ?? '').trim() as DeletionEmailKind;
    if (!KINDS.has(kindRaw)) {
      return Response.json(
        { error: 'kind must be reminder, confirmed, or cancelled' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    let stage: DeletionReminderStage | undefined;
    if (kindRaw === 'reminder') {
      const stageRaw = (body.stage ?? '7d').trim() as DeletionReminderStage;
      if (!STAGES.has(stageRaw)) {
        return Response.json(
          { error: 'stage must be 7d, 3d, 24h, or 1h11m' },
          { status: 400, headers: corsHeaders(origin) }
        );
      }
      stage = stageRaw;
    }

    const householdName = (body.householdName ?? 'your household').trim();

    const { subject, html, text } = renderHouseholdDeletionEmail({
      kind: kindRaw,
      name: (body.name ?? userName ?? to.split('@')[0] ?? 'there').trim(),
      householdName,
      stage,
      purgeDate: body.purgeDate,
      recoverUrl: body.recoverUrl,
      optOutUrl: body.optOutUrl,
      confirmBy: body.confirmBy,
      confirmUrl: body.confirmUrl,
      cancelUrl: body.cancelUrl,
      homeUrl: body.homeUrl,
    });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: SUPPORT,
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('Resend deletion email error', res.status, detail.slice(0, 400));
      return Response.json(
        { error: 'Could not send deletion email right now.' },
        { status: 502, headers: corsHeaders(origin) }
      );
    }

    return Response.json(
      { ok: true, to, kind: kindRaw, stage: stage ?? null, householdId: body.householdId ?? null },
      { headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error('send-household-deletion-email', error);
    return Response.json(
      { error: 'Could not send deletion email.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
});
