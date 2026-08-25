# Remaining work

**Branch:** `cursor/choremaxx-make-v14`  
**TestFlight in ASC:** **1.3.0 (41)** uploaded (Apple processing). **40** is Revision G without the post-40 IUI pass.  
**Next cut:** **1.3.0 (42)** — do **not** upload until the list below is in the IPA.  
**Do not** start from v13 / v12 / v11 / v7. **Do not** re-port Figma Make, rewrite welcome/sign-in splash animations, or collapse House Rules to the kid card.

---

## TestFlight 42 (this cut)

41 is git `f70af99`. Everything below is **not** in 41 and must land before 42.

### Already on this branch (after 41)

- **Repeating chores** — change who / how often after assign; Skip today; Stop repeating (`fe03103`, [`task-series-ux.md`](./task-series-ux.md)).
- **Auth email copy** — Send Email Hook 502 maps to “couldn’t send confirmation,” not a rate limit (`16b74d9`, [`resend-auth-email.md`](./resend-auth-email.md)).

### Settings (Apple IA)

- Redo Settings as a short grouped list, not a dump of every toggle.
- First screen: who you are, then drill-ins (People, House Rules, Notifications, Places, Poppins, Premium, Account).
- Progressive disclosure. Rare controls stay behind a tap. Groceries is a tab, not a setting.
- Same interaction for lists, toggles, destructive actions (confirm only when irreversible).

### Poppins AI meter (test instrument)

- **$4.99/mo** is pricing context only — not a dashboard.
- Meter **per person**. Admin sees each user’s spend. Do not send anyone to the OpenAI global usage page.
- Household trip at **$4.00** — Poppins **goes off** so we can time how long $4 lasts.
- Observation copy in Settings + a quiet Poppins caption. No token marketplace.

### Master spec §A (launch blockers that are still client-side)

- **A-2** — one error layer; 8-character `sb-request-id` support code; password copy is 8 characters; never dump JSON/headers.
- **A-3** — role tiles **Admin / Sidekick / Shared device** with spec subtitles/chips; no emoji on the tiles.
- **A-4** — remove the hygiene footnote from onboarding (mechanic stays; copy only in House Rules).
- **A-5** — drop Meritocracy vs Equity from onboarding. Ship Meritocracy only.

### Device smoke added on 42

- Edit a repeating chore’s regularity after assign; Skip today.
- New email signup after Resend domain verify (not a previously hammered address).
- Settings first screen is a short list; admin opens Poppins meter and sees per-person $.
- After **$4** household AI, Speak/chat pauses with a calm reason.
- Fresh install: Admin / Sidekick / Shared device tiles; no Equity step; no hygiene footnote.

Two lists only. Agents do not mix dashboard / Apple / device steps into coding work.

---

## Parked (leave aside)

### Poppins IUI — shipping on this tip (beats / HOLD unchanged)

Architecture: [`iui-ux-architecture.md`](./iui-ux-architecture.md). Method: [`iui-method-note.md`](./iui-method-note.md).

- **P1** Memory / continuity — Speak continues for 4h. Hangup pauses an open HOLD; next Speak restores. WebRTC still tears down.
- **P2** Stage as the primary surface — live act is on the Poppins tab. Keyboard is a side door (shown by default only on Expo Go).
- **P3** Beats / HOLD / barge-in — grammar unchanged; hangup/background is pause, not veto.
- **P4** Strip mixed leftover — Activity sheet is history only; closing it does not cancel the act.
- **P5** Settings / billing / account — coach-navigate only; never HOLD-commit.
- **Apple product logic (in IPA 41)** — one Speak (orb is status); Activity is the hourglass only; returning to the tab shows a frozen act without arming HOLD; mic/network failure opens type-instead; commit failure keeps the preview.

Still worth a TestFlight pass on **41**: barge-in, mic-denied type path, frozen HOLD tap-to-confirm, Speak continuity after hangup.

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
- **S1b** v14 cut — `cursor/choremaxx-make-v14` = v13 + Revision G (`make-v14 · revision-g`), TestFlight **1.3.0 (40)** then **(41)**
- Revision G Sidekick access (storage role stays `child`)
- **Supabase staging** — `20260820200000_revision_g_sidekick.sql` applied (Sidekick redeem / grocery / proposals)
- Login/signup dump sanitizer

Do not redo: v12 aggregate, Assign `difficulty` default, live captions, delete landing, email-confirm UUID, used-link resume, v11 Divine Voice + auth, v10 billing / grocery / Rev F gates, re-porting Figma Make, collapsing House Rules to the kid card, welcome / sign-in splash rewrites unless explicitly asked.

---

## You do (now)

**42 is not uploaded yet.** Wait for **41** in TestFlight, then this cut. Not Expo Go mock. Not `sarah@orbit.test`. 41 is git tip `f70af99`. 42 adds the list at the top of this file.

1. **Apple processing** — wait until 1.3.0 (**41**) is Available in [TestFlight](https://appstoreconnect.apple.com/apps/6796850110/testflight/ios), then install 41 (40 is Revision G without the post-40 IUI pass).
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
8. **Optional website** — when `Choremaxx-Website` push works: `/auth/callback` bridge, `/join/[code]`, AASA, families-only copy. Not required to install 41.

Cursor environment: add `EXPO_TOKEN` as a **dashboard secret** (do not paste in chat) so the next Cloud Agent can ship without re-login.
