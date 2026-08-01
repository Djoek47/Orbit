# Supabase staging setup (Orbit)

Use this when moving from Expo Go mock mode to live household sync + Nova GPT.

## 1. Create project

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Copy **Project URL** and **anon public** key.

## 2. Apply schema (order matters)

**Use the SQL Editor. Run one file at a time, in this order:**

1. `supabase/schema.sql` ← **start here** (creates `household_members` then helper functions)
2. `supabase/migrations/20260716000000_ai_conversations.sql`
3. `supabase/migrations/20260716180000_family_time_os.sql`
4. `supabase/migrations/20260716200000_nova_majordomo.sql`
5. `supabase/migrations/20260716210000_rooms_and_grocery_notes.sql`
6. `supabase/migrations/20260720230000_shared_device_role.sql`

Do **not** run a later migration first — you’ll get `relation "public.household_members" does not exist`.

If a previous run failed halfway: open **Table Editor** and check whether `household_members` exists. If not, re-run the fixed `schema.sql` from a clean New query (tables use `IF NOT EXISTS`, so re-running is safe).

```bash
# Option B: CLI (applies migrations in dated order)
npx supabase link --project-ref YOUR_REF
npx supabase db push
```

## 3. Deploy edge functions

```bash
npx supabase functions deploy nova-briefing
npx supabase functions deploy nova-chat
npx supabase functions deploy nova-voice
npx supabase functions deploy nova-monitor
npx supabase functions deploy nova-realtime-session
npx supabase functions deploy join-household
```

Apply `20260716200000_nova_majordomo.sql` for away windows + `notification_prefs`. See [supabase/functions/README.md](../supabase/functions/README.md) for Monitor cron.

## 4. Set secrets (Dashboard → Edge Functions → Secrets, or CLI)

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | Nova chat, briefings, voice STT, Monitor, Realtime session mint |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side joins, briefing writes, Monitor cron |

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

Enable **Email** auth in Supabase → Authentication → Providers.

**Disable Confirm email for staging/TestFlight.** The app has no confirmation-mail deep link yet. With confirmation on, `signUp` returns a user but no session, so Get Started / Sign in break. Path: Authentication → Providers → Email → turn off **Confirm email**. Dashboard **Add user** + **Auto Confirm User** also works for demo accounts.

For **Sign in with Apple** (required for TestFlight Apple button):

1. Enable the Apple provider in Supabase (Services ID, Team ID, Key ID, `.p8` — see [Supabase Apple login](https://supabase.com/docs/guides/auth/social-login/auth-apple)).
2. Callback / Site URL host: `https://YOUR_PROJECT.supabase.co`
3. App ID `app.choremaxx.household` must also have Sign in with Apple capability (EAS / Apple Developer).

`sarah@orbit.test` exists only in Expo Go mock mode — create real Auth users for staging/TestFlight.
