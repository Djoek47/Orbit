# ChoreMaxx make-v28

**Branch:** `cursor/make-v28`  
**Follows TestFlight:** **1.3.0 (100)** @ `947a2fc` (EAS `4babe53b…`)  
**Tip (this cut):** see latest commit on the branch.

## Included since TestFlight 1.3.0 (100)

| Area | What landed |
| --- | --- |
| Shared devices | Faces tutorial, QR hand-over, Switch N-arrows (2–6), livelier People card |
| Sidekick proof | Stabilize camera URI → signed PUT + base64 fallback → edge `submit_proof` → https `proof_uri` |
| Invites | Emma / profile-code collisions; false Sidekick complete errors |
| Shopping Lock Screen | Tap to check off, pager, + field polish |
| Poppins | Base hybrid listen, voice wheel, typing composer, English-only |
| Trips / places | Plan trips polish, nearby cache, Live Activity loop, DIY colors, Family run contrast |
| Alerts / Support | Themed `OrbitAlert`, Support screen, `send-support-feedback` edge |
| Credits SQL | `household_credit_balance` view (credits never expire) — **apply on staging** |

## Supabase deploy checklist (staging)

**Applied 2026-10-01** on `dejrbyufotcvcillnneo` (Choremaxx-Staging):

| Item | Status |
| --- | --- |
| `sidekick-task-action` | Deployed |
| `send-support-feedback` | Deployed (`RESEND_API_KEY` + `RESEND_FROM_EMAIL` present) |
| `poppins-voice` | Deployed |
| `20260930220000_credits_never_expire.sql` | Applied — view `household_credit_balance` exists |
| `task-proofs` bucket | Present (public, 10 MB) |

Credit remaining inquiry:

```sql
select household_id, credits_available, credits_purchased, credits_spent, last_purchase_at
from public.household_credit_balance
order by credits_available desc;
```

## Proof path (Sidekick + shared tablet) — must stay green

1. Pick/capture → `stabilizeLocalProofUri` (cache file)
2. `usesProfileCodeAuth` → `sidekickSubmitTaskProof`
3. `prepare_proof_upload` + optional signed PUT
4. `submit_proof` with https and/or base64 → service-role upload
5. Task row stores **https** `proof_uri`; admins see Attached photo on any device

## Switch tab (shared tablet)

Fifth slot = Switch (not Poppins). Glyph = N double-arrows:

- 2 left–right · 3 triangle · 4 square · 5 pentagon · 6 hexagon (cap)

## TestFlight

| Build | Branch / commit | Notes |
| --- | --- | --- |
| **1.3.0 (100)** | `947a2fc` | Last submitted before this cut |
| **1.3.0 (102)** queued | `cursor/make-v28` @ `a89fcd2` | [c6c7a77a](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/c6c7a77a-7372-44b0-8f9d-788b46c86b83) — proof / Switch / Support / trips; [auto-submit](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/84e0d33f-a0e1-419e-9d46-48253ec300a8) |

Non-interactive EAS needed `EXPO_NO_CAPABILITY_SYNC=1` (Apple App Groups patch for LiveActivity fails without an interactive session).

## TestFlight env (`eas.json`)

Unchanged — `testflight` profile, supabase data mode, channel `testflight`.
