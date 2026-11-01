/**
 * New-device sign-in alert.
 *
 * Called by the app right after a successful sign-in, with the caller's own session. The first
 * time a (person, device) pair is seen, it emails:
 *   - the person: "New sign-in to your ChoreMaxx account" — when, which device, which network;
 *     if it wasn't them, reset the password;
 *   - the admins of each household they belong to (not themselves), so a parent knows when
 *     someone in the house signs in on a new phone or tablet.
 * Repeat sign-ins on a known device send nothing (only last_seen_at moves).
 *
 * The address comes from the verified session, never the request body, so this cannot be used
 * to email anyone else.
 *
 * Secrets: RESEND_API_KEY, RESEND_FROM_EMAIL (optional)
 * Deploy:  supabase functions deploy login-alert
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { EMAIL_COLORS, alertBoxHtml, escapeHtml, firstName, infoRowsHtml, wrapEmailCard } from '../_shared/email-brand.ts';
import { corsHeaders, jsonResponse } from '../_shared/poppins-auth.ts';

const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Choremaxx <noreply@choremaxx.app>';
const SUPPORT = 'support@choremaxx.app';
const RESET_URL = 'https://www.choremaxx.app/reset-password';

type Body = { deviceId?: string; deviceName?: string; platform?: string; timeZone?: string };

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max) : '';

function whenLine(timeZone: string): string {
  const now = new Date();
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timeZone || 'UTC',
      timeZoneName: 'short',
    }).format(now);
  } catch {
    return now.toUTCString();
  }
}

async function send(resendKey: string, to: string, subject: string, html: string, text: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], reply_to: SUPPORT, subject, html, text }),
  });
  if (!res.ok) console.warn('login-alert send', res.status, await res.text().catch(() => ''));
}

const p = (html: string) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:23px;color:${EMAIL_COLORS.body};">${html}</p>`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user?.email) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = (await req.json().catch(() => ({}))) as Body;
    const deviceId = clean(body.deviceId, 80);
    if (deviceId.length < 8) return jsonResponse({ error: 'deviceId required' }, 400);
    const deviceName = clean(body.deviceName, 80) || 'A device';
    const platform = clean(body.platform, 40);
    const timeZone = clean(body.timeZone, 64);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: inserted } = await admin
      .from('login_devices')
      .upsert(
        { user_id: user.id, device_id: deviceId, device_name: deviceName, platform },
        { onConflict: 'user_id,device_id', ignoreDuplicates: true }
      )
      .select('device_id');
    const isNew = Boolean(inserted && inserted.length);
    if (!isNew) {
      await admin
        .from('login_devices')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('device_id', deviceId);
      return jsonResponse({ ok: true, newDevice: false });
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return jsonResponse({ ok: true, newDevice: true, emailed: false });

    const { count } = await admin
      .from('login_devices')
      .select('device_id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    const firstEver = (count ?? 0) <= 1;

    const { data: profile } = await admin.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    const name = (profile?.display_name as string | null) || user.email.split('@')[0];
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'Unknown';
    const when = whenLine(timeZone);
    const device = platform ? `${deviceName} (${platform})` : deviceName;
    const rows = infoRowsHtml([
      { label: 'When', value: when },
      { label: 'Device', value: device },
      { label: 'Network address', value: ip },
    ]);

    // The person.
    const subject = firstEver ? 'You signed in to ChoreMaxx' : 'New sign-in to your ChoreMaxx account';
    const html = wrapEmailCard({
      subject,
      badge: 'Security',
      badgeColor: EMAIL_COLORS.info,
      heading: firstEver ? 'Welcome in' : 'New sign-in',
      introHtml:
        p(`Hi ${escapeHtml(firstName(name))},`) +
        p(
          firstEver
            ? 'Your ChoreMaxx account was just opened for the first time.'
            : 'Your ChoreMaxx account was just opened on a device we haven’t seen before.'
        ),
      bodyHtml:
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">${rows}</table>` +
        alertBoxHtml('danger', 'Wasn’t you? Reset your password now and write to support@choremaxx.app.') +
        p(`<a href="${RESET_URL}" style="color:${EMAIL_COLORS.coral};font-weight:700;">Reset password</a>`),
    });
    const text = `${subject}\n\nWhen: ${when}\nDevice: ${device}\nNetwork address: ${ip}\n\nWasn't you? Reset your password: ${RESET_URL}`;
    await send(resendKey, user.email, subject, html, text);

    // The admins of each household this person is in (not the person themselves).
    const { data: memberships } = await admin
      .from('household_members')
      .select('household_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active');
    const houses = (memberships ?? []).map((m: { household_id: string }) => m.household_id);
    if (houses.length) {
      const { data: admins } = await admin
        .from('household_members')
        .select('user_id, household_id')
        .in('household_id', houses)
        .eq('status', 'active')
        .in('role', ['owner', 'admin'])
        .neq('user_id', user.id);
      const ids = [...new Set((admins ?? []).map((a: { user_id: string | null }) => a.user_id).filter(Boolean))] as string[];
      for (const id of ids) {
        const { data: au } = await admin.auth.admin.getUserById(id);
        const to = au?.user?.email;
        if (!to) continue;
        const s = `${firstName(name)} signed in on a new device`;
        await send(
          resendKey,
          to,
          s,
          wrapEmailCard({
            subject: s,
            badge: 'Household security',
            badgeColor: EMAIL_COLORS.info,
            heading: s,
            introHtml: p(`${escapeHtml(name)} just opened ChoreMaxx on a device your household hasn’t seen them use before.`),
            bodyHtml:
              `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">${rows}</table>` +
              p('If that doesn’t sound right, check with them, or remove them in Settings › Members.'),
          }),
          `${s}\n\nWhen: ${when}\nDevice: ${device}\nNetwork address: ${ip}`
        );
      }
    }

    return jsonResponse({ ok: true, newDevice: true, emailed: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
