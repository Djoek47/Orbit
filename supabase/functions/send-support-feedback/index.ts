/**
 * Support feedback → Resend inbox (support@choremaxx.app).
 *
 * Secrets: RESEND_API_KEY, RESEND_FROM_EMAIL (optional), SUPPORT_INBOX (optional)
 * Deploy: npx supabase functions deploy send-support-feedback
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Choremaxx <noreply@choremaxx.app>';
const INBOX = Deno.env.get('SUPPORT_INBOX') ?? 'support@choremaxx.app';

type Body = {
  message?: string;
  errorLog?: string;
  errorCount?: number;
  memberName?: string;
  householdId?: string;
  meta?: Record<string, unknown>;
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
        { error: 'Support email is not configured yet.' },
        { status: 503, headers: corsHeaders(origin) }
      );
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    let userEmail = '';
    let userId = '';
    if (authHeader && supabaseUrl && anon) {
      const supabase = createClient(supabaseUrl, anon, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await supabase.auth.getUser();
      userEmail = data.user?.email ?? '';
      userId = data.user?.id ?? '';
    }

    const body = (await req.json()) as Body;
    const message = (body.message ?? '').trim();
    if (!message) {
      return Response.json({ error: 'Message required' }, { status: 400, headers: corsHeaders(origin) });
    }

    const metaLines = Object.entries(body.meta ?? {})
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join('\n');
    const subject = `[Choremaxx Support] ${message.slice(0, 60)}${message.length > 60 ? '…' : ''}`;
    const text = [
      message,
      '',
      '——',
      `From: ${body.memberName || 'Unknown'} ${userEmail ? `<${userEmail}>` : ''}`.trim(),
      userId ? `User id: ${userId}` : '',
      body.householdId ? `Household: ${body.householdId}` : '',
      metaLines,
      body.errorCount ? `Errors attached: ${body.errorCount}` : '',
      body.errorLog ? `\n—— Error log ——\n${body.errorLog}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [INBOX],
        reply_to: userEmail || undefined,
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('Resend support error', res.status, detail.slice(0, 400));
      return Response.json(
        { error: 'Could not send feedback right now.' },
        { status: 502, headers: corsHeaders(origin) }
      );
    }

    return Response.json({ ok: true }, { headers: corsHeaders(origin) });
  } catch (error) {
    console.error('send-support-feedback', error);
    return Response.json(
      { error: 'Could not send feedback.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
});
