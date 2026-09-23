# Orbit Supabase Edge Functions

Deploy after creating a Supabase project and applying migrations (including `20260716000000_ai_conversations.sql` and `20260716200000_nova_majordomo.sql`).

```bash
npx supabase functions deploy poppins-briefing
npx supabase functions deploy poppins-chat
npx supabase functions deploy poppins-voice
npx supabase functions deploy poppins-monitor
npx supabase functions deploy poppins-notify
npx supabase functions deploy poppins-realtime-session
npx supabase functions deploy poppins-realtime-sdp
npx supabase functions deploy poppins-voice-tool
npx supabase functions deploy join-household
npx supabase functions deploy complete-profile-join
npx supabase functions deploy redeem-profile-invite
npx supabase functions deploy sidekick-sync --no-verify-jwt
npx supabase functions deploy register-sidekick-push --no-verify-jwt
npx supabase functions deploy dispatch-member-push
npx supabase functions deploy sidekick-task-action --no-verify-jwt
npx supabase functions deploy sidekick-grocery-action --no-verify-jwt
npx supabase functions deploy sidekick-event-action --no-verify-jwt
# Auth emails via Resend (optional if Custom SMTP is enough — see docs/resend-auth-email.md)
npx supabase functions deploy send-auth-email --no-verify-jwt
npx supabase secrets set OPENAI_API_KEY=sk-...
# Optional model overrides (defaults: gpt-realtime-2.1, gpt-5.6-luna)
# npx supabase secrets set OPENAI_REALTIME_MODEL=gpt-realtime-2.1
# npx supabase secrets set OPENAI_POPPINS_CHAT_MODEL=gpt-5.6-luna
# npx supabase secrets set POPPINS_VOICE_GRANT_ALL=1
# Service role required for cron → poppins-monitor
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
# Resend (Send Email Hook path only)
# npx supabase secrets set RESEND_API_KEY=re_...
# npx supabase secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_..."
# npx supabase secrets set RESEND_FROM_EMAIL="Choremaxx <noreply@choremaxx.app>"
# Expo push (Sidekick + cross-device notifications)
# npx supabase secrets set EXPO_ACCESS_TOKEN=...
```

See [docs/supabase-staging-setup.md](../docs/supabase-staging-setup.md) for full staging steps.  
Auth email delivery: [docs/resend-auth-email.md](../docs/resend-auth-email.md).  
Post-tool spoken response ADR: [docs/adr-poppins-post-tool-response-create.md](../docs/adr-poppins-post-tool-response-create.md).

| Function | Purpose |
|----------|---------|
| `poppins-briefing` | Daily/weekly briefings + recommendation payloads (JWT + active member) |
| `poppins-chat` | Conversational Poppins (Luna) with household context + history |
| `poppins-voice` | Whisper STT + short GPT reply for Talk to Poppins (Whisper fallback) |
| `poppins-monitor` | Monitor Agent tool loop → Activity log; inbox only for blocking asks |
| `poppins-notify` | Luna (`gpt-5.6-luna`) writes/summarizes one inbox sentence from facts |
| `poppins-realtime-session` | Mints ephemeral OpenAI Realtime client secret (Expo Go WS fallback) |
| `poppins-realtime-sdp` | Server SDP for WebRTC duplex (`POST /v1/realtime/calls`) |
| `poppins-voice-tool` | Tool executor for live voice (`forceRiskyConfirmation: true`) |
| `join-household` | Invite-code join with pending membership |
| `sidekick-sync` | Sidekick poll: tasks, notifications, calendar events (profile code) |
| `sidekick-task-action` | Sidekick complete task / submit proof (profile code, no JWT) |
| `register-sidekick-push` | Register Expo push token for Sidekick devices |
| `dispatch-member-push` | Send Expo push to audience members after inbox notification |
| `send-auth-email` | Auth Send Email Hook → Resend (confirm / recovery / magic link); deploy with `--no-verify-jwt` |

## Poppins Monitor cron

**Not applied by migrations.** Confirm in the dashboard / `cron.job` before assuming live spend — see [docs/poppins-monitor-ops.md](../docs/poppins-monitor-ops.md).

The app also invokes `poppins-monitor` once per household session (JWT + full snapshot). Edge gates: rules-first, `POPPINS_MONITOR_MODEL` (default off), active local hours, daily model-call cap 3.

Example schedule — **4 UTC ticks** that each household evaluates against **local** slots (08/15/18/20). Rotating cursor guarantees full coverage without `limit 50`:

```sql
-- Requires extensions: pg_cron, pg_net
-- Cursor table (also in migrations/20260916230000_ai_usage_events_metering.sql)
create table if not exists public.monitor_cron_cursor (
  id int primary key default 1 check (id = 1),
  after_household_id uuid,
  updated_at timestamptz not null default now()
);
insert into public.monitor_cron_cursor (id) values (1) on conflict do nothing;

select cron.schedule(
  'poppins-monitor-pass',
  '0 * * * *',  -- hourly; edge filters to 4 local slots
  $$
  with cur as (
    select after_household_id from public.monitor_cron_cursor where id = 1
  ),
  batch as (
    select h.id
    from public.households h, cur
    where cur.after_household_id is null or h.id > cur.after_household_id
    order by h.id
    limit 25
  ),
  posted as (
    select net.http_post(
      url := 'https://YOUR_PROJECT.supabase.co/functions/v1/poppins-monitor',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || 'YOUR_SERVICE_ROLE_KEY'
      ),
      body := jsonb_build_object(
        'householdId', b.id,
        'household', jsonb_build_object('timezone', (select timezone from public.households where id = b.id)),
        'metrics', '{}'::jsonb
      )
    ) as request_id
    from batch b
  ),
  advanced as (
    update public.monitor_cron_cursor
    set after_household_id = coalesce((select max(id) from batch), null),
        updated_at = now()
    where id = 1
      and (select count(*) from batch) > 0
    returning after_household_id
  )
  -- Wrap: if batch empty, reset cursor to null so next tick starts from the beginning
  update public.monitor_cron_cursor
  set after_household_id = null, updated_at = now()
  where id = 1 and not exists (select 1 from batch);
  $$
);
```

Full coverage: each tick advances past the last id in the batch of 25; when the batch is empty the cursor resets to null and the next tick starts from the lowest id again.

For a single household “Run Poppins check now” from the app, invoke with the user JWT + active membership and a compact household snapshot in the body.

Mock / Expo Go mode uses `runPoppinsMonitor()` in the Orbit store (local rule engine, same notification writers) — no edge required.

Secrets:

- `POPPINS_MONITOR_MODEL` — default off (rules/templates only)
- `POPPINS_ACTS_PER_DAY` — default 30 (UI follow-up)
- Confirm `POPPINS_VOICE_GRANT_ALL` is **not** `1` in production (P0)
