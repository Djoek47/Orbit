/**
 * Premium trial / subscription start → Resend receipt to the buyer.
 *
 * Secrets: RESEND_API_KEY, RESEND_FROM_EMAIL (optional)
 * Deploy: npx supabase functions deploy send-subscription-receipt
 *
 * Used for Expo Go mock trials and future StoreKit subscriptions.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { renderSubscriptionReceiptEmail } from './branded-html.ts';

const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Choremaxx <noreply@choremaxx.app>';
const SUPPORT = 'support@choremaxx.app';

type Body = {
  to?: string;
  name?: string;
  plan?: string;
  price?: string;
  renewalDate?: string;
  manageUrl?: string;
  inTrial?: boolean;
  mock?: boolean;
  householdId?: string;
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
        { error: 'Subscription email is not configured yet.' },
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
        { error: 'No email on file for this receipt.' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const plan = (body.plan ?? '').trim();
    const price = (body.price ?? '').trim();
    const renewalDate = (body.renewalDate ?? '').trim();
    if (!plan || !price || !renewalDate) {
      return Response.json(
        { error: 'plan, price, and renewalDate required' },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const { subject, html, text } = renderSubscriptionReceiptEmail({
      name: (body.name ?? userName ?? to.split('@')[0] ?? 'there').trim(),
      plan,
      price,
      renewalDate,
      manageUrl: body.manageUrl,
      inTrial: Boolean(body.inTrial),
      mock: Boolean(body.mock),
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
      console.error('Resend subscription receipt error', res.status, detail.slice(0, 400));
      return Response.json(
        { error: 'Could not send subscription email right now.' },
        { status: 502, headers: corsHeaders(origin) }
      );
    }

    return Response.json(
      { ok: true, to, householdId: body.householdId ?? null },
      { headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error('send-subscription-receipt', error);
    return Response.json(
      { error: 'Could not send subscription email.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
});
