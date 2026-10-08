/**
 * Support feedback → Resend inbox (support@choremaxx.app) + user ack.
 *
 * Secrets: RESEND_API_KEY, RESEND_FROM_EMAIL (optional), SUPPORT_INBOX (optional)
 * Deploy: npx supabase functions deploy send-support-feedback
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { renderSupportAckEmail } from './branded-ack.ts';

const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Choremaxx <noreply@choremaxx.app>';
const INBOX = Deno.env.get('SUPPORT_INBOX') ?? 'support@choremaxx.app';

type Attachment = {
  filename?: string;
  content?: string;
  contentType?: string;
};

type Body = {
  message?: string;
  errorLog?: string;
  errorCount?: number;
  categories?: Record<string, number>;
  memberName?: string;
  householdId?: string;
  meta?: Record<string, unknown>;
  screenshotUrls?: string[];
  attachments?: Attachment[];
};

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

function ticketRef(): string {
  return `CMX-SUP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
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

    const ref = ticketRef();
    const errorCount = Number(body.errorCount) || 0;
    const screenshotUrls = Array.isArray(body.screenshotUrls)
      ? body.screenshotUrls.filter((u) => typeof u === 'string' && u.startsWith('http')).slice(0, 3)
      : [];
    const attachments = Array.isArray(body.attachments)
      ? body.attachments
          .filter((a) => a?.content && a?.filename)
          .slice(0, 3)
          .map((a) => ({
            filename: String(a.filename),
            content: String(a.content),
            content_type: a.contentType || 'image/jpeg',
          }))
      : [];
    const screenshotCount = screenshotUrls.length + attachments.length;

    const categoryLine = body.categories
      ? Object.entries(body.categories)
          .map(([k, v]) => `${k}:${v}`)
          .join(', ')
      : '';

    const metaLines = Object.entries(body.meta ?? {})
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join('\n');

    const subject = `[Choremaxx Support ${ref}] ${message.slice(0, 50)}${message.length > 50 ? '…' : ''}`;
    const text = [
      message,
      '',
      '——',
      `Ticket: ${ref}`,
      `From: ${body.memberName || 'Unknown'} ${userEmail ? `<${userEmail}>` : ''}`.trim(),
      userId ? `User id: ${userId}` : '',
      body.householdId ? `Household: ${body.householdId}` : '',
      categoryLine ? `Categories: ${categoryLine}` : '',
      metaLines,
      errorCount ? `Errors attached: ${errorCount}` : '',
      screenshotUrls.length
        ? `Screenshot URLs:\n${screenshotUrls.map((u) => `- ${u}`).join('\n')}`
        : '',
      attachments.length ? `Screenshot files attached: ${attachments.length}` : '',
      body.errorLog ? `\n—— Error log ——\n${body.errorLog}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const inboxRes = await fetch('https://api.resend.com/emails', {
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
        attachments: attachments.length ? attachments : undefined,
      }),
    });

    if (!inboxRes.ok) {
      const detail = await inboxRes.text();
      console.error('Resend support inbox error', inboxRes.status, detail.slice(0, 400));
      return Response.json(
        { error: 'Could not send feedback right now.' },
        { status: 502, headers: corsHeaders(origin) }
      );
    }

    let ackEmailed = false;
    if (userEmail) {
      const ack = renderSupportAckEmail({
        name: body.memberName || userEmail.split('@')[0] || 'there',
        ticketRef: ref,
        errorCount,
        screenshotCount,
      });
      const ackRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: [userEmail],
          reply_to: INBOX,
          subject: ack.subject,
          html: ack.html,
          text: ack.text,
        }),
      });
      if (!ackRes.ok) {
        const detail = await ackRes.text();
        console.warn('Resend support ack skipped', ackRes.status, detail.slice(0, 200));
      } else {
        ackEmailed = true;
      }
    }

    // File it in the console's inbox too (support_tickets). Best effort: the email above is
    // already on its way, and a missing table (console migration not applied) must not fail
    // the customer's message.
    try {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (supabaseUrl && serviceKey) {
        const admin = createClient(supabaseUrl, serviceKey);
        const meta = (body.meta ?? {}) as Record<string, unknown>;
        const topCategory = body.categories
          ? Object.entries(body.categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
          : null;
        const { error: ticketError } = await admin.from('support_tickets').insert({
          ref,
          via: 'app',
          category: topCategory,
          subject: message.slice(0, 120),
          body: message,
          from_name: body.memberName ?? null,
          from_email: userEmail || null,
          user_id: userId || null,
          household_id: body.householdId ?? null,
          member_role: typeof meta.role === 'string' ? meta.role : null,
          app_version: typeof meta.appVersion === 'string' ? meta.appVersion : null,
          device: typeof meta.device === 'string' ? meta.device : null,
          error_count: errorCount,
          error_log: body.errorLog?.slice(0, 20000) ?? null,
          meta: { ...meta, screenshotUrls, categories: body.categories ?? {} },
        });
        if (ticketError) console.warn('support ticket not filed', ticketError.message);
      }
    } catch (fileError) {
      console.warn('support ticket not filed', fileError);
    }

    return Response.json(
      { ok: true, ticketRef: ref, ackEmailed },
      { headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error('send-support-feedback', error);
    return Response.json(
      { error: 'Could not send feedback.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
});
