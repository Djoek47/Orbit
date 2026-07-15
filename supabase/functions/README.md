# Orbit Supabase Edge Functions

Deploy after creating a Supabase project and applying migrations (including `20260716000000_ai_conversations.sql`).

```bash
npx supabase functions deploy nova-briefing
npx supabase functions deploy nova-chat
npx supabase functions deploy nova-voice
npx supabase functions deploy join-household
npx supabase secrets set OPENAI_API_KEY=sk-...
```

See [docs/supabase-staging-setup.md](../docs/supabase-staging-setup.md) for full staging steps.

| Function | Purpose |
|----------|---------|
| `nova-briefing` | Daily/weekly briefings + recommendation payloads (JWT + active member) |
| `nova-chat` | Conversational Nova with household context + history |
| `nova-voice` | Whisper STT + short GPT reply for Talk to Nova |
| `join-household` | Invite-code join with pending membership |
