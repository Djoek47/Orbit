# Remaining work

**Branch:** `cursor/choremaxx-make-v14`  
**TestFlight in ASC:** **1.3.0 (40)**  
**Do not** start from v13 / v12 / v11 / v7. **Do not** re-port Figma Make, rewrite welcome/sign-in, or collapse House Rules to the kid card.

Two lists only. Agents do not mix dashboard / Apple / device steps into coding work. No new TestFlight IPA until MYTIKAS says this You-do list is done.

---

## Parked (leave aside)

### Poppins IUI — wait for MYTIKAS to say go

Detail: [`poppins-rework.md`](./poppins-rework.md), method: [`iui-method-note.md`](./iui-method-note.md). Code today: `lib/poppins/ui-scenes.ts`, `ui-tool-map.ts`, `ui-orchestrator.ts`, `components/orbit/poppins-stage.tsx`.

Beats: SHOW → NARROW → UNFOLD → HOLD → SETTLE → CHAIN.

- **P1** Memory / continuity — WebRTC `end()` currently wipes the realtime session (`lib/voice/poppins-voice-session.ts`)
- **P2** Stage as the primary surface — captions thin or gone; stop treating chat as the product
- **P3** Beats / HOLD / barge-in — reliable on TestFlight voice
- **P4** Strip mixed leftover — stacked transcripts, duplicate rails, Assign/Create vs HOLD-commit
- **P5** Settings / billing / account — coach-navigate only; never HOLD-commit

### After IUI (not Review-blocking)

- **F1** Contrast audit (Rev F §7)
- **F2** Add-member 4-step wizard (Rev F §8)
- **F3** Invite RLS (Rev F §3.6 — UI gated; server RLS still needs the invite-table migration on Supabase)
- **F4** PersistentScrollView sweep
- **F5** Create Task Quick presets on the legacy screen
- **F6** Allowance period-close ledger write
- **F7** Trophy Part 1 names (engine is example-seed only — do not invent 100)
- **F8** Master Brief Q2 — monthly Rescue vs lifetime free-first (already shipping monthly; confirm)

### Needs live ops / other repo / keys (cannot finish from Orbit alone)

- **W1 / W3 / W4** — `Djoek47/Choremaxx-Website` (last push 403). Briefs: [`website-agent-email-confirmation.md`](./website-agent-email-confirmation.md), [`website-agent-handoff.md`](./website-agent-handoff.md)
- **W6 / W8** — templates in `emails/` exist; dispatch needs Resend + Auth Hook live. [`email-templates.md`](./email-templates.md)
- **W7** — App Store Server API (needs Apple keys)
- **S6** — key rotation **after** App Review (Resend, OpenAI, `SEND_EMAIL_HOOK_SECRET`)
- Watch / iPad / Vision / smart home / design-system batches ([`ecosystem/watch-vision-roadmap.md`](./ecosystem/watch-vision-roadmap.md), [`design-system/10-cursor-tasks.md`](./design-system/10-cursor-tasks.md))

### Already done

- **S1** v13 cut — `cursor/choremaxx-make-v13` @ 1.3.0 (`make-v13 · final`), TestFlight **1.3.0 (39)**
- **S1b** v14 cut — `cursor/choremaxx-make-v14` = v13 + Revision G (`make-v14 · revision-g`), TestFlight **1.3.0 (40)**
- Revision G Sidekick access (storage role stays `child`)
- Login/signup dump sanitizer

Do not redo: v12 aggregate, Assign `difficulty` default, live captions, delete landing, email-confirm UUID, used-link resume, v11 Divine Voice + auth, v10 billing / grocery / Rev F gates, re-porting Figma Make, collapsing House Rules to the kid card, welcome / sign-in splash rewrites unless explicitly asked.

---

## You do (now)

On **TestFlight 40**, not Expo Go mock. Not `sarah@orbit.test`. Git tip may be ahead of 40 (Sidekick Get Started label, 23:59 expiry tick, Family iPad). Smoke 40 as shipped; those land on the **next** IPA after this pass.

1. **Apple processing** — wait until 1.3.0 (40) is Available in [TestFlight](https://appstoreconnect.apple.com/apps/6796850110/testflight/ios), then install 40 (39 is v13 without Revision G).
2. **Supabase staging** — apply `supabase/migrations/20260820200000_revision_g_sidekick.sql` (Sidekick redeem / grocery / proposals). If Luna is still the old model id, set `OPENAI_POPPINS_CHAT_MODEL=gpt-5.6-luna` and redeploy Poppins functions (S3).
3. **Auth email (W2)** — if the Send Email Hook is not on: enable it in the Supabase dashboard ([`resend-auth-email.md`](./resend-auth-email.md)). Signup on device → mail → confirm in app.
4. **Device smoke (S2 + S4 + v14)** — real account:
   - Assign a library task; Poppins Speak → IUI HOLD
   - House Rules, 4 directions, Admin and Sidekick
   - Places **MapView** on the IPA (Expo Go is the fallback)
   - Homework roles, expired tasks
   - Delete account → Get Started
   - Sidekick invite: instant Home, tabs Home / Tasks / Plan / Ranks, no Poppins
   - Hold & Request closed on an empty day
   - Grocery-add toggle default off
   - Failed signup shows short copy, not JSON
5. **IAP on the binary (W5)** — ASC → Choremaxx → Subscriptions: monthly `app.choremaxx.household.premium.monthly` is already live; attach subscription products to this binary for Review. Yearly stays Settings-only ([`asc-iap-setup.md`](./asc-iap-setup.md)).
6. **Demo account** — Supabase Auth user, auto-confirm, one staged household (admin + Sidekick). Put email/password in Review notes.
7. **App Review (S5)** — after smoke: listing copy, privacy/terms URLs, demo account, submit. Draft: [`app-store-checklist.md`](./app-store-checklist.md). Legal URLs are still `choremaxx.vercel.app` until the website cutover.
8. **Optional website** — when `Choremaxx-Website` push works: `/auth/callback` bridge, `/join/[code]`, AASA, families-only copy. Not required to install 40.

Cursor environment: add `EXPO_TOKEN` as a **dashboard secret** (do not paste in chat) so the next Cloud Agent can ship without re-login.
