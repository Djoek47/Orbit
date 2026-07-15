# Orbit Supabase Edge Functions

Deploy after creating a Supabase project:

```bash
npx supabase functions deploy nova-briefing
npx supabase functions deploy nova-chat
npx supabase functions deploy join-household
npx supabase secrets set OPENAI_API_KEY=sk-...
```

| Function | Purpose |
|----------|---------|
| `nova-briefing` | Daily/weekly briefings + recommendation payloads |
| `nova-chat` | Conversational Nova answers |
| `join-household` | Invite-code join with pending membership |
