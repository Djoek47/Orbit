# Weekend ship automation — ChoreMaxx

**Prepared:** 2026-08-06 · **Restored:** 2026-08-10 · **Updated:** 2026-08-13 (v12 aggregate)  
**Start from:** `cursor/choremaxx-make-v13` @ latest tip  
**Now:** TestFlight **1.3.0** — v12 + today’s invites, GPS/shopping, AIUIC. See [`docs/choremaxx-make-v13.md`](./choremaxx-make-v13.md).  

> ## ⚠️ THIS WEEKEND WAS MISSED — EXECUTE NOW
>
> Final Revision (Master Brief + Rev C–F) landed on v10. The **App Store ship list below (A1–B7) was not run**.
> That is the active work. Do **Phase A fully, then Phase B**. Do not invent features; do not re-port Figma Make.

This doc is the **automation-ready playbook**. Paste the block under [Automation prompt](#automation-prompt-paste-into-cursor-automation) into a Cursor Automation, or open this file in Agent mode and say: *Execute Phase A then Phase B from docs/weekend-ship-automation.md*.

---

## Already done — do not redo

| Done | Notes |
|------|--------|
| Revision D STOP GATES | Late Credit, expiry, streak cliffs/rescue, crowns, recess, notification batching |
| Revision E | Intro slogans, closed notification registry wired, reward/allowance ledgers UI, vocab |
| Revision C grocery | Offline classifier, aisle shopping + keep-awake, Home cart card, admin-only clear |
| **Final Revision F** | Occurrence dedupe, Expired tab, per-member invites, Hold & Request gate, Assign sticky page, shortName, Create allowance + progress, assignee-only complete, R30–R33 — see `docs/logic/REVISION_F_COMPLETION_REPORT.md` |
| House Rules 4-views | Chapters / Glance / Track / Ask Poppins × **Admin / Sidekick** (v12 restored HTML; no kid card) |
| Canada grocery planner | ~2.5k catalog, search/browse, favorites/buy-again, per-item emoji |
| Smart Shopping | HTML bible × orbit tokens |
| Monthly Rescue token | 1/month product override |
| Q1 = B Hold & Request | Gate + N26/N27 path |
| Expo Go keep-alive + OTA | Channel `testflight` |
| Website live | https://choremaxx.vercel.app/ — **A1 still must wire app/ASC URLs** |
| Divine Voice + v11 aggregate | WebRTC duplex, Luna, expanded tools, pre-final TestFlight 1.1.0 — see `docs/choremaxx-make-v11.md` |
| OpenAI ready | Connect via Supabase (**A6**) + `poppins-realtime-sdp` / `poppins-voice-tool` on staging |

**Do not** re-port Figma Make, switch off v10, or invent features outside Master Brief §3.

### Rev F polish still open (not blocking A1–B7)

Contrast audit F7 · Add-member 4-step wizard F8 · invite RLS F3.6 · full PersistentScrollView sweep · create-task Quick presets cleanup on legacy screen · allowance period-close ledger write.

---

## Product locks (carry into every phase)

| Topic | Lock |
|-------|------|
| Branch | `cursor/choremaxx-make-v12` (v13 cut from here tomorrow) |
| Rule Sheet | `docs/logic/choremaxx-MASTER-BRIEF.md` §3 wins conflicts |
| AI name in product strings | **Poppins** (Master Brief §3.1) |
| Families only | No roommate mode in shipping product (site still markets roommates — fix in A1/B4) |
| Allowance | Tracker only — **Mark as paid**; never send/pay/transfer |
| Pricing | 7-day trial · **$4.99/mo** · **$48/yr** (20% off $60) + tax via Apple |
| Data mode | Expo Go may stay mock; TestFlight / store builds use `EXPO_PUBLIC_DATA_MODE=supabase` |

---

## Phase order (anti-redundant)

```
Phase A (foundation) → Phase B (craft) → Phase C (interactive menus) → stop
Do A fully before B. Do not start B7 until B6 is green.
After v11 TestFlight smoke tonight: Phase C1 (tomorrow).
```

### Phase A — foundation  ← **MISSED — START HERE**

| ID | Status | Task | Done when |
|----|--------|------|-----------|
| **A1** | ◐ PARTIAL | Website URLs + support email | In-repo legal + ASC draft + EAS privacy/terms env done. **Still external:** push/redeploy `Choremaxx-Website` + live privacy/terms. |
| **A2** | ◐ CONNECTED | Auth emails via Resend | Secrets + `send-auth-email` deployed. **Still:** Auth Hook in dashboard + signup smoke → `choremaxx://auth/callback`. |
| **A3** | ◐ IN APP | IAP scaffold + Settings Premium | Catalog + mock trial UI. **Blocked:** ASC products (`docs/asc-iap-setup.md`) then StoreKit on next native build. |
| **A4** | ✅ UNIT | Rewards smoke | Gate + Mark as paid ledger tests green. Staging device smoke optional. |
| **A5** | ✅ | Notifications foundation | Quiet hours pref + banner deferral 21:00–07:00; Settings toggle. |
| **A6** | ✅ EDGE | Poppins OpenAI connect | Key set + functions ACTIVE + smoke PASS. **Still human:** device chat in TestFlight #27. |
| **A7** | ✅ UNIT | Account matrix | Role permission tests green. |
| **A8** | ◐ DRAFT | Store package draft | ASC fields in `docs/app-store-checklist.md`. Do not submit until B7. |

### Phase B — craft

| ID | Status | Task | Done when |
|----|--------|------|-----------|
| **B1** | ✅ | Poppins as craft | Co-manager tone, existing tools only. |
| **B2** | ◐ EXISTING | Poppins itineraries | Create/adjust Plan within existing models. |
| **B3** | ✅ | Notification actions | Approve / proof / reward deep links. |
| **B4** | ☐ TODO | Site payment gates | CTAs match IAP; remove roommate promises — **external site**. |
| **B5** | ☐ TODO | Billing emails | After A3 products exist. |
| **B6** | ◐ PARTIAL | Full retest | Suites via `npm run test:weekend-a`; device matrix still human. |
| **B7** | ☐ TODO | App Review submit | Only after B6 green + A8 + legal URLs live. |

### Phase C — Realtime Interactive Menus (tomorrow, post–v11 smoke)

Poppins drives **visible** Tasks / Plan menus while speaking — assignment pickers, itinerary stop advances, row highlights. Full spec: [`docs/realtime-interactive-menus.md`](./realtime-interactive-menus.md).

| ID | Status | Task | Done when |
|----|--------|------|-----------|
| **C1** | ☐ TODO | Realtime Interactive Menus v1 | `PoppinsUiOrchestrator` + Tasks assignment animation + Plan itinerary advance + mini rail; voice **and** text twin paths; device acceptance in spec |
| **C1.1** | ☐ | UI orchestrator + session bus | `ui_actions[]` from voice-tool / executor → tab subscribers |
| **C1.2** | ☐ | Tasks & assignment menus | Create-task prefill stagger, row highlight, assignment sheet |
| **C1.3** | ☐ | Plan & itinerary menus | Stop advance animation, calendar agenda highlight |
| **C1.4** | ☐ | Poppins presence rail | Bottom banner + orb sync on driven screens |
| **C1.5** | ☐ | Smoke + matrix | Rows added to `docs/expo-go-test-matrix.md` |

**Branch:** stay on `cursor/choremaxx-make-v12`. **Requires** TestFlight build with Divine Voice + WebRTC for full duplex demo; Expo Go gets text-path choreography only.

### Final — key rotations (LAST, after B7 / ship)

Do **not** rotate mid-weekend while hooks are being tested. After App Review package is stable:

| Secret | Where | Why |
|--------|-------|-----|
| Resend API key | Resend dashboard → Supabase `RESEND_API_KEY` | Appeared in agent terminal history |
| OpenAI API key | OpenAI dashboard → Supabase `OPENAI_API_KEY` | Appeared in agent terminal history |
| `SEND_EMAIL_HOOK_SECRET` | Supabase Auth Hook + secrets | Rotate if hook URL was shared |
| Any pasted tokens | Terminal history / chat | Prefer dashboard recreate + `secrets set` |

---

## Automation prompt (paste into Cursor Automation)

```
You are shipping ChoreMaxx for App Store readiness.

BRANCH (mandatory):
- git fetch && git checkout cursor/choremaxx-make-v12 && git pull
- Commit and push ONLY on this branch. Do not create cursor/*-c30d sprawl.

READ FIRST:
- docs/weekend-ship-automation.md  (this playbook — Phase A then B, then C tomorrow)
- docs/realtime-interactive-menus.md  (Phase C1 spec)
- docs/choremaxx-make-v12.md  (TestFlight aggregate + v13 checklist)
- docs/logic/choremaxx-MASTER-BRIEF.md §3 (wins all conflicts)
- docs/logic/REVISION_F_COMPLETION_REPORT.md (Final Revision already landed — do not redo)
- docs/product-context.md, docs/technical-blueprint.md
- docs/testflight-setup.md, docs/email-templates.md, docs/resend-auth-email.md

HARD RULES:
- Do not invent features. Do not re-port Figma Make.
- Poppins in product strings (not Nova) per Master Brief.
- Families only — no roommate mode in shipping product.
- Allowance never sends money — Mark as paid.
- Pricing: 7-day trial, $4.99/mo, $48/yr via Apple IAP.
- Prefer Expo Go for UI checks; use TestFlight/supabase for store paths.
- After each phase slice: commit, push, OTA to channel testflight.
- Fill a short completion report per A/B item (pass/fail + what you skipped).

EXECUTE IN ORDER:
1. Phase A1 → A8 completely (finish remaining ◐ items).
2. Then Phase B1 → B7.
3. After v11 TestFlight smoke: Phase C1 Realtime Interactive Menus (docs/realtime-interactive-menus.md).
4. Stop and report if blocked on secrets (Resend API key, OpenAI, ASC IAP products, EAS iOS build quota).

START: Confirm branch tip SHA, then begin A1.
```

---

## Human checklist (when you return)

1. Open TestFlight — latest native build + OTA channel `testflight`.
2. Paste the Automation prompt **or** tell Agent: *Execute docs/weekend-ship-automation.md Phase A then B*.
3. Have ready: Resend API key, OpenAI key in Supabase secrets, ASC IAP access, site repo if marketing lives outside Orbit.

---

## Related docs

- [next-session.md](./next-session.md) — short pointer to this playbook  
- [choremaxx-make-v12.md](./choremaxx-make-v12.md) — v12 aggregate + v13 checklist  
- [realtime-interactive-menus.md](./realtime-interactive-menus.md) — **tomorrow Phase C1**  
- [logic/REVISION_F_COMPLETION_REPORT.md](./logic/REVISION_F_COMPLETION_REPORT.md)  
- [testflight-setup.md](./testflight-setup.md)  
- [logic/choremaxx-MASTER-BRIEF.md](./logic/choremaxx-MASTER-BRIEF.md)
