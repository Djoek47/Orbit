# Supabase staging setup (Orbit)

Use this when moving from Expo Go mock mode to live household sync + Nova GPT.

## 1. Create project

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Copy **Project URL** and **anon public** key.

## 2. Apply schema

```bash
# Option A: SQL editor — paste supabase/schema.sql
# Option B: CLI
npx supabase link --project-ref YOUR_REF
npx supabase db push
# Then apply conversation migration:
# supabase/migrations/20260716000000_ai_conversations.sql
```

## 3. Deploy edge functions

```bash
npx supabase functions deploy nova-briefing
npx supabase functions deploy nova-chat
npx supabase functions deploy nova-voice
npx supabase functions deploy join-household
```

## 4. Set secrets (Dashboard → Edge Functions → Secrets, or CLI)

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | Nova chat, briefings, voice STT |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side joins + briefing writes |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically for edge functions.

## 5. Client `.env` (do not commit)

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_DATA_MODE=supabase
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Optional: live GPT while household repos stay mock
EXPO_PUBLIC_NOVA_AI=openai
```

## 6. Verify in Expo Go

```bash
npm run start:tunnel   # Cloud Agent / remote VM
# or
npm run start:lan      # same Wi‑Fi as laptop
```

See [expo-go-test-matrix.md](./expo-go-test-matrix.md) for the full manual checklist.

## 7. Auth note

Enable Email auth in Supabase → Authentication → Providers. For Apple Sign-In, configure separately before production.
