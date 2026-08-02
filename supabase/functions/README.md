# Orbit Supabase Edge Functions

Deploy after creating a Supabase project and applying migrations (including `20260716000000_ai_conversations.sql` and `20260716200000_nova_majordomo.sql`).

```bash
npx supabase functions deploy poppins-briefing
npx supabase functions deploy poppins-chat
npx supabase functions deploy poppins-voice
npx supabase functions deploy poppins-monitor
npx supabase functions deploy poppins-realtime-session
npx supabase functions deploy join-household
npx supabase secrets set OPENAI_API_KEY=sk-...
# Service role required for cron → poppins-monitor
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

See [docs/supabase-staging-setup.md](../docs/supabase-staging-setup.md) for full staging steps.

| Function | Purpose |
|----------|---------|
| `poppins-briefing` | Daily/weekly briefings + recommendation payloads (JWT + active member) |
| `poppins-chat` | Conversational Poppins with household context + history |
| `poppins-voice` | Whisper STT + short GPT reply for Talk to Poppins (Whisper fallback) |
| `poppins-monitor` | Monitor Agent tool loop → `notifications` + `ai_recommendations` |
| `poppins-realtime-session` | Mints ephemeral OpenAI Realtime client secret (never ships long-lived key) |
| `join-household` | Invite-code join with pending membership |

## Poppins Monitor cron

Schedule `poppins-monitor` about every 15 minutes per active household (pg_cron + `net.http_post`, or Supabase scheduled functions).

Example with `pg_cron` + `pg_net` (adjust project URL / keys):

```sql
-- Requires extensions: pg_cron, pg_net
select cron.schedule(
  'poppins-monitor-pass',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/poppins-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'YOUR_SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object(
      'householdId', h.id,
      'household', '{}'::jsonb,
      'metrics', '{}'::jsonb
    )
  )
  from public.households h
  limit 50;
  $$
);
```

For a single household “Run Poppins check now” from the app, invoke with the user JWT + active membership and a compact household snapshot in the body.

Mock / Expo Go mode uses `runPoppinsMonitor()` in the Orbit store (local rule engine, same notification writers) — no edge required.
