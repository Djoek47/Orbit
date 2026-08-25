# Remaining work

**Branch:** `cursor/choremaxx-make-v14`  
**TestFlight in ASC:** **1.3.0 (42)** submitted (MYTIKAS). Git tip `f37422e`. **41** was `f70af99` (one-Speak IUI). **40** is Revision G without the post-40 IUI pass.  
**Do not** upload another 42. **Do not** start from v13 / v12 / v11 / v7. **Do not** re-port Figma Make, rewrite welcome/sign-in splash animations, or collapse House Rules to the kid card.

---

## TestFlight 42 (submitted)

42 is git `f37422e` on `cursor/choremaxx-make-v14`. In the IPA vs 41:

- **Repeating chores** — change who / how often after assign; Skip today; Stop repeating (`fe03103`, [`task-series-ux.md`](./task-series-ux.md)).
- **Auth email copy** — Send Email Hook 502 maps to “couldn’t send confirmation,” not a rate limit (`16b74d9`, [`resend-auth-email.md`](./resend-auth-email.md)).
- **Settings** — short grouped list (People, House, Notifications, Places, Poppins, Premium). Groceries is a tab.
- **AI meter** — per person; household trip at **$4.00**; Poppins pauses. **$4.99/mo** is pricing context only.
- **§A-2–A-5** — support codes; Admin / Sidekick / Shared device tiles; no hygiene footnote; no Equity step.
- **IUI genie** — `hearAndDrive`, merge same beat, HOLD ~0.85s; hourglass does not cover a live act; voice failure drops Done/PROCESSING.
- **Task done** — whole-pill green wash.

### Device smoke on 42

- Edit a repeating chore’s regularity after assign; Skip today.
- New email signup after Resend domain verify (not a previously hammered address).
- Settings first screen is a short list; admin opens Poppins meter and sees per-person $.
- After **$4** household AI, Speak/chat pauses with a calm reason.
- Fresh install: Admin / Sidekick / Shared device tiles; no Equity step; no hygiene footnote.
- Speak → words land on the stage immediately; hourglass does not cover a live HOLD.
- Complete a task: whole row washes green.

Two lists only. Agents do not mix dashboard / Apple / device steps into coding work.

---

## Parked (leave aside)

### Poppins IUI — shipping on this tip (beats / HOLD unchanged)

Architecture: [`iui-ux-architecture.md`](./iui-ux-architecture.md). Method: [`iui-method-note.md`](./iui-method-note.md).

- **P1** Memory / continuity — Speak continues for 4h. Hangup pauses an open HOLD; next Speak restores. WebRTC still tears down.
- **P2** Stage as the primary surface — live act is on the Poppins tab. Keyboard is a side door (shown by default only on Expo Go).
- **P3** Beats / HOLD / barge-in — grammar unchanged; hangup/background is pause, not veto.
- **P4** Strip mixed leftover — Activity sheet is history only; hourglass does not open over a live HOLD; closing it does not cancel the act. Spoken words paint immediately (`hearAndDrive`); Luna merges the same beat (no SHOW restart). HOLD ~0.85s.
- **P5** Settings / billing / account — coach-navigate only; never HOLD-commit.
- **Apple product logic (in IPA 41+)** — one Speak (orb is status); Activity is the hourglass only; returning to the tab shows a frozen act without arming HOLD; mic/network failure opens type-instead; commit failure keeps the preview.

Still worth a TestFlight pass on **42**: barge-in, mic-denied type path, frozen HOLD tap-to-confirm, Speak continuity after hangup, genie paint, whole-pill done.

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
- **S1b** v14 cut — `cursor/choremaxx-make-v14` = v13 + Revision G (`make-v14 · revision-g`), TestFlight **1.3.0 (40)** then **(41)** then **(42)** @ `f37422e`
- Revision G Sidekick access (storage role stays `child`)
- **Supabase staging** — `20260820200000_revision_g_sidekick.sql` applied (Sidekick redeem / grocery / proposals)
- Login/signup dump sanitizer

Do not redo: v12 aggregate, Assign `difficulty` default, live captions, delete landing, email-confirm UUID, used-link resume, v11 Divine Voice + auth, v10 billing / grocery / Rev F gates, re-porting Figma Make, collapsing House Rules to the kid card, welcome / sign-in splash rewrites unless explicitly asked.

---

## You do (now)

**42 is submitted.** Not Expo Go mock. Not `sarah@orbit.test`. 42 is git tip `f37422e`. Do not cut 43 unless asked.

1. **Apple processing** — wait until 1.3.0 (**42**) is Available in [TestFlight](https://appstoreconnect.apple.com/apps/6796850110/testflight/ios), then install 42 (41 is one-Speak IUI only; 40 is Revision G without the post-40 IUI pass).
2. **Luna (S3)** — if Luna is still the old model id, set `OPENAI_POPPINS_CHAT_MODEL=gpt-5.6-luna` and redeploy Poppins functions. Revision G SQL is already on staging.
3. **Auth email (W2)** — Send Email Hook **is on**. Live signup returns `unexpected_failure` / **hook 502** because Resend rejected the send (unverified domain, bad `from`, or test-mode recipient). Fix in [Resend](https://resend.com/domains) + Supabase secret `RESEND_API_KEY` / `RESEND_FROM_EMAIL`. Apple Sign-In does not use this path. Details: [`resend-auth-email.md`](./resend-auth-email.md).
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
8. **Optional website** — when `Choremaxx-Website` push works: `/auth/callback` bridge, `/join/[code]`, AASA, families-only copy. Not required to install 42.

Cursor environment: add `EXPO_TOKEN` as a **dashboard secret** (do not paste in chat) so the next Cloud Agent can ship without re-login.
