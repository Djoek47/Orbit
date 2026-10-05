# Staging deploy — push from your PC

One checklist for everything still needed after the fin / Settings P0 work lands on `cursor/make-v31`.
**Do not** ship TestFlight until product says so.

Repo: https://github.com/Djoek47/Orbit  
Branch with this work: `cursor/settings-signout-touch-c30d` (merge into `cursor/make-v31` first).

---

## 0) Pull the branch

```bash
cd /path/to/Orbit
git fetch origin
git checkout cursor/make-v31
git pull origin cursor/make-v31
# after PR merge of settings-signout-touch:
git pull origin cursor/make-v31
```

---

## 1) Supabase — migrations (SQL editor or CLI)

Apply **in order** if not already on staging. Prefer the full migration files:

| Order | File |
|------:|------|
| 1 | `supabase/migrations/20261005120000_support_uploads_storage.sql` |
| 2 | `supabase/migrations/20261005140000_household_deletion_v2.sql` |
| 3 | `supabase/migrations/20261005150000_household_transfer.sql` |

Also skim `supabase/migrations/PENDING_APPLY_ON_STAGING.sql` for older columns / verify queries.

CLI:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_…"   # https://supabase.com/dashboard/account/tokens
npx supabase link --project-ref YOUR_STAGING_REF
npx supabase db push
# or paste each migration into the SQL editor and run
```

Verify:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('household_transfer_tokens');

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'households'
  and column_name in (
    'deletion_reminder_stage',
    'deletion_reminders_opt_out',
    'deletion_immediate_token',
    'deletion_immediate_token_expires_at'
  );

select id from storage.buckets where id = 'support-uploads';
```

---

## 2) Supabase — edge functions (deploy all new/updated)

From repo root (linked project):

```bash
export SUPABASE_ACCESS_TOKEN="sbp_…"

npx supabase functions deploy send-credit-receipt
npx supabase functions deploy send-subscription-receipt
npx supabase functions deploy send-household-deletion-email
npx supabase functions deploy send-support-feedback
npx supabase functions deploy transfer-household
npx supabase functions deploy household-deletion-cron --no-verify-jwt
```

Secrets the edges need (Dashboard → Edge Functions → Secrets, or CLI):

| Secret | Used by |
|--------|---------|
| `RESEND_API_KEY` | all send-* email edges |
| `SUPABASE_SERVICE_ROLE_KEY` | cron, transfer, storage signs |
| `OPENAI_API_KEY` | Poppins (existing) |
| `EXPO_ACCESS_TOKEN` | push (existing) — `npm run supabase:sync-expo-push-secret` |

Schedule **household-deletion-cron** hourly (Dashboard → Edge Functions → Schedules, or `pg_cron` + `net.http_post`). Staging: set `DELETION_REMINDER_STAGING=1` to compress the ladder.

Full command list: `supabase/functions/README.md`.

---

## 3) App / Expo (optional OTA — not TestFlight)

```bash
# Expo Go / tunnel for UI checks
cp -n .env.example .env
npm install
npm run start:tunnel
```

Keep `EXPO_PUBLIC_DATA_MODE=mock` for Expo Go design checks.  
TestFlight / EAS builds already force `supabase` via `eas.json` — **do not submit TF until asked**.

---

## 4) Device QA after this P0 fix (Expo Go or existing TF build)

1. Open Settings → tap **X** → Home / tabs respond to touch immediately.  
2. Settings → Poppins → drag voice wheel → back to main → **X** → tabs still touchable.  
3. Settings → **Sign Out** → see **Signing out…** overlay → land on Get Started; stay signed out after force-quit.  
4. Confirm **Email tests / Send test email** is gone from Settings.  
5. Sign in again and open household normally.

---

## 5) If sign-out still fails on a real Supabase session

Usually means staging JWT / SecureStore wipe path — confirm:

- App points at the same Supabase project you just migrated.  
- `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` match staging.  
- After sign-out, Keychain / SecureStore auth keys are cleared (`lib/auth/local-sign-out.ts` always wipes local even if remote logout times out at 4s; leave hard-ceiling is 12s).
