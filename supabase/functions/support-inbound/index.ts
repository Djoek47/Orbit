/**
 * Resend → support inbox.
 *
 * Resend calls this webhook (event `email.received`) when someone writes to
 * support@choremaxx.app. The webhook carries only metadata, so the body is fetched from
 * Resend's received-email API, then stored as a ticket — or, when the subject carries a
 * ticket ref like "[CMX-4821]", appended to that ticket as the customer's reply.
 *
 * Secrets:
 *   RESEND_API_KEY              to fetch the email body
 *   RESEND_INBOUND_SECRET       the webhook's signing secret (whsec_…), from the Resend dashboard
 *
 * Deploy with --no-verify-jwt: Resend has no Supabase JWT; the Svix signature is the check.
 *   supabase functions deploy support-inbound --no-verify-jwt
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type ReceivedWebhook = {
  type: string;
  data: { email_id: string; from: string; to: string[]; subject?: string; created_at?: string };
};

const enc = new TextEncoder();

/** Svix signature check: HMAC-SHA256 of "id.timestamp.body" with the base64 secret. */
async function verifySvix(req: Request, body: string, secret: string): Promise<boolean> {
  const id = req.headers.get('svix-id');
  const ts = req.headers.get('svix-timestamp');
  const sigHeader = req.headers.get('svix-signature');
  if (!id || !ts || !sigHeader) return false;
  // Reject anything older than 5 minutes — replayed webhooks.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${id}.${ts}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // Header holds space-separated "v1,<sig>" entries; any match passes.
  return sigHeader.split(' ').some((part) => {
    const sig = part.split(',')[1];
    if (!sig || sig.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

function ticketRef(): string {
  return `CMX-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Strip the quoted history under a reply so the thread shows only what was written now. */
function newestPart(text: string): string {
  const cut = text.search(/\n(On .+wrote:|-----Original Message-----|Le .+a écrit :)/);
  return (cut > 0 ? text.slice(0, cut) : text).trim();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const body = await req.text();
  const secret = Deno.env.get('RESEND_INBOUND_SECRET') ?? '';
  if (!secret || !(await verifySvix(req, body, secret))) {
    return new Response('bad signature', { status: 401 });
  }

  const event = JSON.parse(body) as ReceivedWebhook;
  if (event.type !== 'email.received') return Response.json({ ignored: event.type });

  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  const res = await fetch(`https://api.resend.com/emails/receiving/${event.data.email_id}`, {
    headers: { Authorization: `Bearer ${resendKey}` },
  });
  if (!res.ok) {
    console.error('support-inbound fetch body', res.status, (await res.text()).slice(0, 300));
    // 500 makes Resend retry later.
    return new Response('could not fetch email', { status: 500 });
  }
  const email = (await res.json()) as {
    from?: string;
    subject?: string;
    text?: string | null;
    html?: string | null;
    headers?: Record<string, string>;
  };

  const fromHeader = email.headers?.from ?? email.from ?? event.data.from;
  const fromEmail = (fromHeader.match(/<([^>]+)>/)?.[1] ?? fromHeader).trim().toLowerCase();
  const fromName = fromHeader.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || null;
  const subject = (email.subject ?? event.data.subject ?? '').trim();
  const text =
    email.text ??
    (email.html ?? '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // A reply to an existing ticket: "Re: [ChoreMaxx Support CMX-4821] …"
  const ref = subject.match(/CMX-\d{4}/)?.[0];
  if (ref) {
    const { data: ticket } = await admin.from('support_tickets').select('id').eq('ref', ref).maybeSingle();
    if (ticket) {
      await admin.from('support_replies').upsert(
        {
          ticket_id: ticket.id,
          direction: 'in',
          author: fromName ?? fromEmail,
          body: newestPart(text),
          resend_email_id: event.data.email_id,
        },
        { onConflict: 'resend_email_id', ignoreDuplicates: true }
      );
      await admin.from('support_tickets').update({ status: 'open' }).eq('id', ticket.id);
      return Response.json({ ok: true, ticket: ref, appended: true });
    }
  }

  // A new conversation. Link it to a household when the sender is an account we know.
  let userId: string | null = null;
  let householdId: string | null = null;
  // Look the sender up among accounts (paged; fine for tens of thousands of users).
  let user: { id: string } | undefined;
  for (let page = 1; page <= 20 && !user; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const list = data?.users ?? [];
    user = list.find((u) => u.email?.toLowerCase() === fromEmail);
    if (list.length < 1000) break;
  }
  if (user) {
    userId = user.id;
    const { data: member } = await admin
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'invited'])
      .limit(1)
      .maybeSingle();
    householdId = member?.household_id ?? null;
  }

  const { error } = await admin.from('support_tickets').upsert(
    {
      ref: ticketRef(),
      via: 'email',
      subject: subject || '(no subject)',
      body: text,
      from_name: fromName,
      from_email: fromEmail,
      user_id: userId,
      household_id: householdId,
      resend_email_id: event.data.email_id,
    },
    { onConflict: 'resend_email_id', ignoreDuplicates: true }
  );
  if (error) {
    console.error('support-inbound insert', error.message);
    return new Response('store failed', { status: 500 });
  }
  return Response.json({ ok: true });
});
