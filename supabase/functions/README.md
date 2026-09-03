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
