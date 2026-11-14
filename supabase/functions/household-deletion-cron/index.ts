/**
 * Hourly cron: deletion reminder ladder + due purge.
 *
 * Auth: service role bearer only.
 * Secrets: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL (optional)
 * Staging: set DELETION_REMINDER_STAGING=1 for minute-scale thresholds.
 *
 * Deploy: npx supabase functions deploy household-deletion-cron --no-verify-jwt
 *
 * Example pg_cron (after secrets + function URL):
 *   select cron.schedule(
 *     'household-deletion-reminders',
 *     '20 * * * *',
 *     $$ select net.http_post(
 *          url := 'https://<project>.supabase.co/functions/v1/household-deletion-cron',
 *          headers := jsonb_build_object(
 *            'Authorization', 'Bearer ' || 'YOUR_SERVICE_ROLE_KEY',
 *            'Content-Type', 'application/json'
 *          ),
 *          body := '{}'::jsonb
 *        ); $$
 *   );
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { renderHouseholdDeletionEmail } from '../send-household-deletion-email/branded-html.ts';

type ReminderStage = '7d' | '3d' | '24h' | '1h11m';

const STAGE_ORDER: ReminderStage[] = ['7d', '3d', '24h', '1h11m'];

const PROD_THRESHOLDS: Record<ReminderStage, number> = {
  '7d': 7 * 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '1h11m': (60 + 11) * 60 * 1000,
};

const STAGING_THRESHOLDS: Record<ReminderStage, number> = {
  '7d': 7 * 60 * 1000,
  '3d': 3 * 60 * 1000,
  '24h': 60 * 1000,
  '1h11m': 11 * 1000,
};

const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Choremaxx <noreply@choremaxx.app>';
const SUPPORT = 'support@choremaxx.app';
const APP_URL = 'https://www.choremaxx.app';

function thresholds(): Record<ReminderStage, number> {
  return Deno.env.get('DELETION_REMINDER_STAGING') === '1'
    ? STAGING_THRESHOLDS
    : PROD_THRESHOLDS;
}

function nextStage(
  scheduledFor: string,
  lastSent: string | null,
  nowMs: number,
  thresh: Record<ReminderStage, number>
): ReminderStage | null {
  const ms = new Date(scheduledFor).getTime() - nowMs;
  if (ms <= 0) return null;
  if (ms > thresh['7d']) return null;
  const lastIdx = lastSent && STAGE_ORDER.includes(lastSent as ReminderStage)
    ? STAGE_ORDER.indexOf(lastSent as ReminderStage)
    : -1;
  for (let i = 0; i < STAGE_ORDER.length; i++) {
    if (i <= lastIdx) continue;
    const stage = STAGE_ORDER[i]!;
    if (ms <= thresh[stage]) return stage;
  }
  return null;
}

function formatPurgeDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isServiceRole(req: Request): boolean {
  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return Boolean(serviceKey) && auth === `Bearer ${serviceKey}`;
}

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
    if (!isServiceRole(req)) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401, headers: corsHeaders(origin) }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: purgedCount, error: purgeError } = await admin.rpc('purge_due_households');
    if (purgeError) {
      console.error('purge_due_households', purgeError.message);
    }

    const { data: rows, error } = await admin
      .from('households')
      .select(
        'id, name, deletion_scheduled_for, deletion_reminder_stage, deletion_reminders_opt_out, deletion_requested_by, owner_id'
      )
      .not('deletion_scheduled_for', 'is', null)
      .is('deleted_at', null)
      .eq('deletion_reminders_opt_out', false)
      .limit(100);

    if (error) {
      console.error('list households', error.message);
      return Response.json(
        { error: 'Could not list households.' },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const thresh = thresholds();
    const nowMs = Date.now();
    let sent = 0;
    let skipped = 0;

    for (const row of rows ?? []) {
      const scheduledFor = row.deletion_scheduled_for as string | null;
      if (!scheduledFor) {
        skipped += 1;
        continue;
      }
      const stage = nextStage(
        scheduledFor,
        (row.deletion_reminder_stage as string | null) ?? null,
        nowMs,
        thresh
      );
      if (!stage) {
        skipped += 1;
        continue;
      }

      const recipientId =
        (row.deletion_requested_by as string | null) ?? (row.owner_id as string | null);
      if (!recipientId) {
        skipped += 1;
        continue;
      }

      const { data: profile } = await admin
        .from('profiles')
        .select('email, display_name')
        .eq('id', recipientId)
        .maybeSingle();

      const to = (profile?.email ?? '').trim();
      if (!to.includes('@')) {
        skipped += 1;
        continue;
      }

      if (!resendKey) {
        console.warn('RESEND_API_KEY missing — marking stage without send', row.id, stage);
      } else {
        const { subject, html, text } = renderHouseholdDeletionEmail({
          kind: 'reminder',
          name: (profile?.display_name as string | null) ?? to.split('@')[0] ?? 'there',
          householdName: (row.name as string) || 'your household',
          stage,
          purgeDate: formatPurgeDate(scheduledFor),
          recoverUrl: APP_URL,
          optOutUrl: APP_URL,
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
          console.error('Resend reminder failed', row.id, stage, detail.slice(0, 300));
          continue;
        }
      }

      const { error: updateError } = await admin
        .from('households')
        .update({ deletion_reminder_stage: stage, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (updateError) {
        console.error('update stage', row.id, updateError.message);
        continue;
      }
      sent += 1;
    }

    return Response.json(
      {
        ok: true,
        purged: purgedCount ?? 0,
        remindersSent: sent,
        skipped,
        staging: Deno.env.get('DELETION_REMINDER_STAGING') === '1',
      },
      { headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error('household-deletion-cron', error);
    return Response.json(
      { error: 'Cron failed.' },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
});
