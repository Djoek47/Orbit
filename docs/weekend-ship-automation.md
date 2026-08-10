# Weekend ship automation — ChoreMaxx

**Prepared:** 2026-08-06 · **Restored:** 2026-08-10 (after Final Revision F)  
**Start from:** `cursor/choremaxx-make-v10-5f8f` @ latest tip  
**PR:** https://github.com/Djoek47/Orbit/pull/29  

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
| House Rules 4-views | Chapters / Glance / Track / Ask Poppins × Adult/Kid |
| Canada grocery planner | ~2.5k catalog, search/browse, favorites/buy-again, per-item emoji |
| Smart Shopping | HTML bible × orbit tokens |
| Monthly Rescue token | 1/month product override |
| Q1 = B Hold & Request | Gate + N26/N27 path |
| Expo Go keep-alive + OTA | Channel `testflight` |
| Website live | https://choremaxx.vercel.app/ — **A1 still must wire app/ASC URLs** |
| OpenAI ready | Connect via Supabase (**A6**) |

**Do not** re-port Figma Make, switch off v10, or invent features outside Master Brief §3.

### Rev F polish still open (not blocking A1–B7)

Contrast audit F7 · Add-member 4-step wizard F8 · invite RLS F3.6 · full PersistentScrollView sweep · create-task Quick presets cleanup on legacy screen · allowance period-close ledger write.

---

## Product locks (carry into every phase)

| Topic | Lock |
|-------|------|
| Branch | `cursor/choremaxx-make-v10-5f8f` only |
| Rule Sheet | `docs/logic/choremaxx-MASTER-BRIEF.md` §3 wins conflicts |
| AI name in product strings | **Poppins** (Master Brief §3.1) |
| Families only | No roommate mode in shipping product (site still markets roommates — fix in A1/B4) |
| Allowance | Tracker only — **Mark as paid**; never send/pay/transfer |
| Pricing | 7-day trial · **$4.99/mo** · **$48/yr** (20% off $60) + tax via Apple |
| Data mode | Expo Go may stay mock; TestFlight / store builds use `EXPO_PUBLIC_DATA_MODE=supabase` |

---

## Phase order (anti-redundant)

```
Phase A (foundation) → Phase B (craft) → stop
Do A fully before B. Do not start B7 until B6 is green.
```

### Phase A — foundation  ← **MISSED — START HERE**

| ID | Status | Task | Done when |
|----|--------|------|-----------|
| **A1** | ◐ PARTIAL | Website URLs + support email | App constants / `.env.example` / `app.json` / email theme → `https://choremaxx.vercel.app/privacy|terms`. Support still `support@choremaxx.app`. **Remaining:** ASC listing fields, EAS secrets refresh, site copy families-only + Poppins (not Nova). |
| **A2** | ☐ TODO | Auth emails via Resend | Wire `emails/*` into `supabase/functions/send-auth-email`. Live test: signup → branded verify → `choremaxx://auth/callback`. |
| **A3** | ☐ TODO | IAP scaffold | StoreKit / `expo-iap` (or RevenueCat): 7-day trial, $4.99/mo, $48/yr. ASC products. Entitlement stub. |
| **A4** | ☐ TODO | Rewards smoke | Staging: mint → claim/Hold & Request → approve → ledger; allowance Mark as paid. |
| **A5** | ☐ TODO | Notifications foundation | Prefs toggles, quiet hours 21:00–07:00, batching, push categories = registry IDs. |
| **A6** | ☐ TODO | Poppins OpenAI connect | Live answers from Poppins tab with household context. |
| **A7** | ☐ TODO | Account matrix | Parent/admin, helper/child, shared tablet — create/join, roles, child-safe surfaces. |
| **A8** | ☐ TODO | Store package draft | ASC listing draft. **Do not submit** until B7. |

### Phase B — craft

| ID | Status | Task | Done when |
|----|--------|------|-----------|
| **B1** | ☐ TODO | Poppins as craft | Co-manager tone, existing tools only. |
| **B2** | ☐ TODO | Poppins itineraries | Create/adjust Plan within existing models. |
| **B3** | ☐ TODO | Notification actions | Approve / proof / reward deep links. |
| **B4** | ☐ TODO | Site payment gates | CTAs match IAP; remove roommate promises. |
| **B5** | ☐ TODO | Billing emails | After A3 products exist. |
| **B6** | ☐ TODO | Full retest | Auth → household → tasks → Plan → Rewards → Poppins → Rules → Recess → push. Expo Go + TestFlight. Suites green. |
| **B7** | ☐ TODO | App Review submit | Only after B6 green + A8 + legal URLs live. |

---

## Automation prompt (paste into Cursor Automation)

```
You are shipping ChoreMaxx for App Store readiness.

BRANCH (mandatory):
- git fetch && git checkout cursor/choremaxx-make-v10-5f8f && git pull
- Commit and push ONLY on this branch. Do not create cursor/*-c30d sprawl.

READ FIRST:
- docs/weekend-ship-automation.md  (this playbook — Phase A then Phase B)
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
1. Phase A1 → A8 completely.
2. Then Phase B1 → B7.
3. Stop and report if blocked on secrets (Resend API key, OpenAI, ASC IAP products, EAS iOS build quota).

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
- [logic/REVISION_F_COMPLETION_REPORT.md](./logic/REVISION_F_COMPLETION_REPORT.md)  
- [testflight-setup.md](./testflight-setup.md)  
- [logic/choremaxx-MASTER-BRIEF.md](./logic/choremaxx-MASTER-BRIEF.md)
