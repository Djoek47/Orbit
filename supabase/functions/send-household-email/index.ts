/**
 * Household notices by email, in the same branded card as the receipts.
 *
 *   sidekick_added          an admin added a Sidekick — what happens next, and the profile code
 *   shared_device_created   a shared tablet was set up — who is on it, how to hand it over
 *   trial_ending            the free trial ends tomorrow — what Apple will do, how to stop it
 *
 * Sent to the signed-in admin who made the change (their address from their own session), so
 * this cannot be used to email anyone else. Each notice is sent once: household_email_log keeps
 * a unique key per household and notice.
 *
 * Secrets: RESEND_API_KEY, RESEND_FROM_EMAIL (optional)
 * Deploy:  supabase functions deploy send-household-email
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  EMAIL_COLORS,
  EMAIL_FONT_STACK,
  alertBoxHtml,
  escapeHtml,
  firstName,
  infoRowsHtml,
  wrapEmailCard,
} from '../_shared/email-brand.ts';

const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Choremaxx <noreply@choremaxx.app>';
const SUPPORT = 'support@choremaxx.app';

type Kind = 'sidekick_added' | 'shared_device_created' | 'trial_ending';
type Body = {
  kind?: Kind;
  householdId?: string;
  /** Sidekick name, or device name. */
  subjectName?: string;
  /** Sidekick's profile code. */
  code?: string;
  /** Names on a shared device. */
  people?: string[];
  /** ISO — trial end. */
  endsAt?: string;
  /** "CA$49.99/year" */
  priceLine?: string;
  /** Unique per notice, so repeats are dropped (e.g. member id, device id, trial end). */
  dedupeKey?: string;
};

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
});

const p = (html: string) =>
  `<p style="margin:0 0 16px;font-family:${EMAIL_FONT_STACK};font-size:16px;line-height:24px;color:${EMAIL_COLORS.body};">${html}</p>`;

function longDate(iso?: string): string {
  if (!iso) return 'soon';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? 'soon'
    : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function render(kind: Kind, b: Body, name: string, household: string) {
  const hi = `Hi ${escapeHtml(firstName(name || 'there'))},`;
  if (kind === 'sidekick_added') {
    const who = escapeHtml(b.subjectName ?? 'your Sidekick');
    const subject = `${b.subjectName ?? 'A Sidekick'} is now in ${household}`;
    return {
      subject,
      html: wrapEmailCard({
        subject,
        badge: 'New Sidekick',
        badgeColor: EMAIL_COLORS.chore,
        heading: `${who} joined the house`,
        introHtml: p(hi) + p(`${who} is now a Sidekick in <strong>${escapeHtml(household)}</strong>. They can see their jobs, earn XP and ask for rewards — nothing else.`),
        bodyHtml:
          `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">${infoRowsHtml([
            { label: 'Sidekick', value: b.subjectName ?? '—' },
            { label: 'Profile code', value: b.code ?? 'In People' },
            { label: 'Household', value: household },
          ])}</table>` +
          p('<strong>Next:</strong> on their phone, open ChoreMaxx, tap <em>I have a code</em> and scan their QR code from People. No email or password needed.') +
          alertBoxHtml('info', 'Keep the profile code private — anyone with it can open this Sidekick’s profile. You can make a new one any time from People.'),
      }),
      text: `${b.subjectName} is now a Sidekick in ${household}. Profile code: ${b.code ?? 'see People'}. On their phone: open ChoreMaxx, tap "I have a code" and scan their QR from People.`,
    };
  }
  if (kind === 'shared_device_created') {
    const device = escapeHtml(b.subjectName ?? 'Shared device');
    const people = (b.people ?? []).filter(Boolean);
    const subject = `${b.subjectName ?? 'A shared device'} is set up`;
    return {
      subject,
      html: wrapEmailCard({
        subject,
        badge: 'Shared device',
        badgeColor: EMAIL_COLORS.info,
        heading: `${device} is ready`,
        introHtml: p(hi) + p(`You set up <strong>${device}</strong> for ${escapeHtml(household)}. Everyone on it taps their own face to open their jobs, XP and rewards.`),
        bodyHtml:
          `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">${infoRowsHtml([
            { label: 'Device', value: b.subjectName ?? '—' },
            { label: 'People on it', value: people.length ? people.join(', ') : 'Add people in Settings' },
          ])}</table>` +
          p('<strong>Hand it over:</strong> open People → the device → <em>Show the code</em>, and scan it with the tablet’s camera. Switch in the tab bar passes it to the next person.'),
      }),
      text: `${b.subjectName} is set up for ${household}. People: ${people.join(', ') || 'none yet'}. Hand it over: People → device → Show the code, scan with the tablet.`,
    };
  }
  // trial_ending
  const subject = 'Your ChoreMaxx free trial ends tomorrow';
  return {
    subject,
    html: wrapEmailCard({
      subject,
      badge: 'Free trial',
      badgeColor: EMAIL_COLORS.warning,
      heading: 'Your free trial ends tomorrow',
      introHtml: p(hi) + p(`Your free trial for <strong>${escapeHtml(household)}</strong> ends on <strong>${escapeHtml(longDate(b.endsAt))}</strong>.`),
      bodyHtml:
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">${infoRowsHtml([
          { label: 'Trial ends', value: longDate(b.endsAt) },
          { label: 'Then', value: b.priceLine ?? 'Your chosen plan' },
          { label: 'Includes', value: '300 Poppins actions a month' },
        ])}</table>` +
        p('If you keep it, nothing to do: Apple starts your subscription automatically and everything carries on.') +
        alertBoxHtml('info', 'To stop it, cancel at least 24 hours before it ends: iPhone Settings → your name → Subscriptions → ChoreMaxx. Your chores and history stay saved either way.'),
    }),
    text: `Your ChoreMaxx free trial ends ${longDate(b.endsAt)}. Then ${b.priceLine ?? 'your plan'} starts automatically. To stop it: iPhone Settings → your name → Subscriptions → ChoreMaxx, at least 24 hours before.`,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  try {
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return Response.json({ skipped: true, error: 'email not configured' }, { status: 503, headers: cors(origin) });

    const url = Deno.env.get('SUPABASE_URL')!;
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: me } = await asUser.auth.getUser();
    const to = me.user?.email ?? '';
    if (!me.user || !to.includes('@')) return Response.json({ skipped: true, error: 'no email on file' }, { status: 400, headers: cors(origin) });

    const body = (await req.json()) as Body;
    const kind = body.kind;
    if (kind !== 'sidekick_added' && kind !== 'shared_device_created' && kind !== 'trial_ending') {
      return Response.json({ error: 'unknown kind' }, { status: 400, headers: cors(origin) });
    }
    if (!body.householdId) return Response.json({ error: 'householdId required' }, { status: 400, headers: cors(origin) });

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Only an admin of that household.
    const { data: membership } = await admin
      .from('household_members')
      .select('role, display_name')
      .eq('household_id', body.householdId)
      .eq('user_id', me.user.id)
      .in('role', ['owner', 'admin'])
      .maybeSingle();
    if (!membership) return Response.json({ error: 'not an admin of this household' }, { status: 403, headers: cors(origin) });

    // Once per notice.
    const key = `${kind}:${body.dedupeKey ?? body.subjectName ?? body.endsAt ?? ''}`;
    const { error: logError } = await admin
      .from('household_email_log')
      .insert({ household_id: body.householdId, key, sent_to: to });
    if (logError) {
      if (logError.code === '23505') return Response.json({ ok: true, duplicate: true }, { headers: cors(origin) });
      console.warn('household_email_log', logError.message);
    }

    const { data: household } = await admin.from('households').select('name').eq('id', body.householdId).maybeSingle();
    const rendered = render(kind, body, String(membership.display_name ?? ''), household?.name ?? 'your household');

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: SUPPORT, subject: rendered.subject, html: rendered.html, text: rendered.text }),
    });
    if (!res.ok) {
      // Let a later attempt try again.
      await admin.from('household_email_log').delete().eq('household_id', body.householdId).eq('key', key);
      console.error('send-household-email', res.status, (await res.text()).slice(0, 300));
      return Response.json({ error: 'send failed' }, { status: 502, headers: cors(origin) });
    }
    return Response.json({ ok: true, to }, { headers: cors(origin) });
  } catch (error) {
    console.error('send-household-email', error);
    return Response.json({ error: 'failed' }, { status: 500, headers: cors(origin) });
  }
});
