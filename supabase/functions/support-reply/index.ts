/**
 * Console → customer. A staff member's reply, sent from support@choremaxx.app through Resend,
 * stored on the ticket, and logged in console_audit.
 *
 * Called by the console with the staff member's Supabase session. Only console_staff may send.
 * Body: { ticketId: string, text: string, close?: boolean }
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const FROM = 'ChoreMaxx Support <support@choremaxx.app>';

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: isStaff } = await asUser.rpc('is_console_staff');
  if (!isStaff) return Response.json({ error: 'not allowed' }, { status: 403, headers: cors(origin) });
  const { data: me } = await asUser.auth.getUser();

  const { ticketId, text, close } = (await req.json()) as { ticketId?: string; text?: string; close?: boolean };
  const reply = (text ?? '').trim();
  if (!ticketId || !reply) return Response.json({ error: 'ticketId and text required' }, { status: 400, headers: cors(origin) });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: ticket } = await admin
    .from('support_tickets')
    .select('id, ref, subject, from_email, from_name')
    .eq('id', ticketId)
    .maybeSingle();
  if (!ticket?.from_email) {
    return Response.json({ error: 'This ticket has no reply address.' }, { status: 400, headers: cors(origin) });
  }

  const first = (ticket.from_name ?? '').split(/\s+/)[0] || 'there';
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55;color:#1E1712;max-width:560px">
    <p>Hi ${escapeHtml(first)},</p>
    ${reply.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')}
    <p style="margin-top:24px">— ChoreMaxx support</p>
    <p style="color:#9C9088;font-size:12px">Ticket ${ticket.ref}. Reply to this email to keep the conversation going.</p>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [ticket.from_email],
      reply_to: 'support@choremaxx.app',
      // The ref in the subject is how the customer's answer finds its way back to this ticket.
      subject: `Re: [ChoreMaxx Support ${ticket.ref}] ${ticket.subject}`.slice(0, 200),
      html,
      text: `Hi ${first},\n\n${reply}\n\n— ChoreMaxx support\nTicket ${ticket.ref}`,
    }),
  });
  if (!res.ok) {
    console.error('support-reply resend', res.status, (await res.text()).slice(0, 300));
    return Response.json({ error: 'Could not send the email.' }, { status: 502, headers: cors(origin) });
  }

  await admin.from('support_replies').insert({
    ticket_id: ticket.id,
    direction: 'out',
    author: me.user?.email ?? 'support',
    body: reply,
  });
  await admin.from('support_tickets').update({ status: close ? 'closed' : 'waiting' }).eq('id', ticket.id);
  await admin.from('console_audit').insert({ staff_id: me.user?.id, action: 'reply', target: ticket.ref });

  return Response.json({ ok: true }, { headers: cors(origin) });
});
