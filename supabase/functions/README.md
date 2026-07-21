# Orbit Supabase Edge Functions

Deploy after creating a Supabase project and applying migrations (including `20260716000000_ai_conversations.sql` and `20260716200000_nova_majordomo.sql`).

```bash
npx supabase functions deploy nova-briefing
npx supabase functions deploy nova-chat
npx supabase functions deploy nova-voice
npx supabase functions deploy nova-monitor
npx supabase functions deploy nova-realtime-session
npx supabase functions deploy join-household
npx supabase secrets set OPENAI_API_KEY=sk-...
# Service role required for cron → nova-monitor
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

See [docs/supabase-staging-setup.md](../docs/supabase-staging-setup.md) for full staging steps.

| Function | Purpose |
|----------|---------|
| `nova-briefing` | Daily/weekly briefings + recommendation payloads (JWT + active member) |
| `nova-chat` | Conversational Nova with household context + history |
| `nova-voice` | Whisper STT + short GPT reply for Talk to Nova (Whisper fallback) |
| `nova-monitor` | Monitor Agent tool loop → `notifications` + `ai_recommendations` |
| `nova-realtime-session` | Mints ephemeral OpenAI Realtime client secret (never ships long-lived key) |
| `join-household` | Invite-code join with pending membership |

## Nova Monitor cron

Schedule `nova-monitor` about every 15 minutes per active household (pg_cron + `net.http_post`, or Supabase scheduled functions).

Example with `pg_cron` + `pg_net` (adjust project URL / keys):

```sql
-- Requires extensions: pg_cron, pg_net
select cron.schedule(
  'nova-monitor-pass',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/nova-monitor',
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

For a single household “Run Nova check now” from the app, invoke with the user JWT + active membership and a compact household snapshot in the body.

Mock / Expo Go mode uses `runNovaMonitor()` in the Orbit store (local rule engine, same notification writers) — no edge required.
