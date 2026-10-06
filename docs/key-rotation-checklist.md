# Key / password rotation checklist

**Do not rotate in this pass** — keep this as the ordered list for a later session.  
**Do not paste secret values into git, PRs, Slack, or agent chats.**

Rotate in dashboards **before public App Store launch** if any of these were ever shared in chat, terminals, CI logs, or screenshots.

| # | Secret / credential | Where to rotate | Notes |
|---|---------------------|-----------------|--------|
| 1 | `OPENAI_API_KEY` | Supabase → Edge Function secrets | Poppins chat / voice / monitor |
| 2 | `RESEND_API_KEY` | Supabase / Auth SMTP (Resend) | Auth + transactional email |
| 3 | `SEND_EMAIL_HOOK_SECRET` | Auth Hook + Edge `send-auth-email` | Must match on both sides |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API | Redeploy all Edge functions after |
| 5 | `SUPABASE_ANON_KEY` | Supabase API + EAS env (`EXPO_PUBLIC_*`) | Especially if leaked while RLS was open |
| 6 | `EXPO_PUBLIC_SUPABASE_URL` / anon | EAS → Project → Environment variables | Production + testflight profiles |
| 7 | `EXPO_TOKEN` / EAS access | Expo account tokens | CI / cloud agents |
| 8 | `SUPABASE_ACCESS_TOKEN` | Supabase account tokens | CLI / agents |
| 9 | Apple Sign In `.p8` key | Apple Developer → Keys | Update Edge / Auth if used |
| 10 | App Store Connect API key | ASC → Users and Access → Keys | EAS submit |
| 11 | App Review demo password | `REVIEW_DEMO_*` + ASC review notes | After review completes |
| 12 | `POPPINS_VOICE_GRANT_ALL` | Supabase Edge secrets | Must be **unset / ≠ `1`** on prod |

## After rotation (when you do it)

1. Redeploy Edge functions that read the new secrets.  
2. Bump EAS env vars and cut a new TestFlight if anon/URL changed.  
3. Smoke: sign-in email, join household, Poppins chat, voice grant denied without entitlement.  
4. Confirm Auth Hook still verifies with the new `SEND_EMAIL_HOOK_SECRET`.

See also: `docs/make-v32-launch-audit.md` §5.
