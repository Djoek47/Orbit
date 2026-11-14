# Poppins monitor — confirm schedule & secrets (ops)

Repo has **no** `cron.schedule` migration. Before treating monitor as live cron spend, confirm in the **production / staging** Supabase project.

## 1. pg_cron jobs

```sql
select jobid, jobname, schedule, active, command
from cron.job
where jobname ilike '%poppins%'
   or command ilike '%poppins-monitor%';
```

- **Rows found + active** → cron is live; treat as fire until rules-first gate ships.
- **Empty** → cron not scheduled in this project; client session kick is still a spend path.

## 2. Dashboard

Database → Extensions → `pg_cron` / Scheduled Functions → look for `poppins-monitor-pass`.

## 3. Edge logs

Filter `poppins-monitor`:

- Service-role bearer + empty `{}` household ≈ cron example body.
- User JWT + full household snapshot ≈ app session kick ([store/orbit-store.tsx](../store/orbit-store.tsx) one pass per household id).

## 4. Secrets (P0)

```bash
npx supabase secrets list --project-ref <ref>
```

Note:

| Secret | Meaning |
|--------|---------|
| `OPENAI_API_KEY` | Model path enabled when set |
| `POPPINS_MONITOR_MODEL` | `off` (default) = rules/templates only; `on` = gated model loop |
| `POPPINS_ACTS_PER_DAY` | Default `30` (UI follow-up) |
| `POPPINS_VOICE_GRANT_ALL` | If `=1`, duplex voice skips premium/trial — **P0 if set in production** |

`POPPINS_VOICE_GRANT_ALL` **can** be set on any project (`supabase secrets set`). Code path: `voiceAccessAllowed` in `supabase/functions/_shared/poppins-realtime-session-config.ts`.
