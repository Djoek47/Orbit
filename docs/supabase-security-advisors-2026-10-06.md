# Supabase security advisors — staging polish (2026-10-06)

Project: `dejrbyufotcvcillnneo` (Choremaxx-Staging)

## Cleared / mitigated in migration `20261006062055`

| Advisor | Action |
|---------|--------|
| `function_search_path_mutable` on `set_updated_at`, `enforce_admin_cap`, `tasks_fill_completion_snapshot`, `storage_*_household_id` | `SET search_path TO public` |
| `anon_security_definer_function_executable` on transfer / deletion / invite / helper RPCs | `REVOKE` from `anon` (+ `public`); keep `authenticated` where clients call |
| Trigger-only defs (`handle_new_user`, activity_log triggers, `set_updated_at`, …) | Revoke `anon` + `authenticated` direct EXECUTE |
| `rls_enabled_no_policy` on `monitor_cron_cursor` | `service_role` policy + revoke table from anon/authenticated |
| Transfer QR `gen_random_bytes does not exist` | `extensions.gen_random_bytes` under `search_path=public` |

## Expected remaining WARN (intentional)

`authenticated_security_definer_function_executable` for client RPCs that **must** stay callable by signed-in users via PostgREST / edge (`create_household_transfer_token`, `accept_household_transfer`, `is_household_member`, deletion RPCs, etc.). Revoking those would break the app. Definer + auth checks inside the function body is the model.

## BLOCKER — Manual Auth dashboard step (before next TF / password ship)

| Advisor | Status | Action |
|---------|--------|--------|
| `auth_leaked_password_protection` | **OPEN — must fix before push** | Supabase Dashboard → project `dejrbyufotcvcillnneo` → **Authentication** → **Providers** / **Password** → enable **Leaked password protection** (HaveIBeenPwned). Not settable from SQL. |

Tracked also in:
- `docs/make-v33-testflight-notes.md` § Blockers before next TestFlight
- `docs/STAGING_DEPLOY_CHECKLIST.md` § 2b
- `docs/app-store-checklist.md` Preconditions
- `scripts/testflight-preflight.sh` (prints blocker reminder)

## Deployed with this pass

- Edge: `transfer-household` (mapped create errors, no raw Postgres)
- SQL: applied via `supabase db query --linked -f …62055…`
