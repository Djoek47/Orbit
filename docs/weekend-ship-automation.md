# Weekend ship automation — ChoreMaxx

**Prepared:** 2026-08-06 (post Rev E + House Rules Part 2)  
**Start tomorrow from:** `cursor/choremaxx-make-v9-5f8f` @ latest tip (includes Rev D scoring, Rev E copy/ledgers, House Rules Direction 01, monthly Rescue token)  
**PR:** https://github.com/Djoek47/Orbit/pull/28  

This doc is the **automation-ready playbook**. Paste the block under [Automation prompt](#automation-prompt-paste-into-cursor-automation) into a Cursor Automation, or open this file in Agent mode and say: *Execute Phase A then Phase B from docs/weekend-ship-automation.md*.

---

## Already done — do not redo

| Done | Notes |
|------|--------|
| Revision D STOP GATES | Late Credit, expiry, streak cliffs/rescue, crowns, recess, notification batching |
| Revision E | Intro slogans, notification registry, reward/allowance ledgers, vocab (no money-send language) |
| House Rules Part 2 | JSON SoT + Direction 01 Chapters Adult/Kid |
| Monthly Rescue token | 1/month; not lifetime free-first |
| Q1 = B special asks | Admin-gated; one pending ask; N26/N27 |
| Expo Go keep-alive + OTA | Channels `august-6` + `testflight` published from `75f5fac` |
| Website live | https://choremaxx.vercel.app/ (privacy/terms exist) — still needs App Store URL wire-up + Master Brief alignment |
| OpenAI ready | Connect Nova/Poppins via Supabase (A6) |

**Do not** re-port Figma Make, switch off v9, or invent features outside Master Brief §3.

---

## Product locks (carry into every phase)

| Topic | Lock |
|-------|------|
| Branch | `cursor/choremaxx-make-v9-5f8f` only |
| Rule Sheet | `docs/logic/choremaxx-MASTER-BRIEF.md` §3 wins conflicts |
| AI name in product strings | **Poppins** (Master Brief §3.1) |
| Families only | No roommate mode in shipping product (site still markets roommates — fix in A1/B4) |
| Allowance | Tracker only — **Mark as paid** / **Approve now**; never send/pay/transfer |
| Pricing | 7-day trial · **$4.99/mo** · **$48/yr** (20% off $60) + tax via Apple |
| Data mode | Expo Go may stay mock; TestFlight / store builds use `EXPO_PUBLIC_DATA_MODE=supabase` (eas.json) |

---

## Phase order (anti-redundant)

```
Phase A (foundation) → Phase B (craft) → stop
Do A fully before B. Do not start B7 until B6 is green.
```

### Phase A — foundation

| ID | Task | Done when |
|----|------|-----------|
| **A1** | Website URLs + support email | App + ASC + Play (if any) Privacy/Terms/Support point at live site. Prefer `https://choremaxx.vercel.app/` until custom domain cutover; sync `EXPO_PUBLIC_PRIVACY_URL` / `TERMS_URL`, `constants/choremaxx-brand.ts`, `emails/theme.ts` logo URL. Support inbox on Resend (or documented alias). Align marketing site with Master Brief: **families only**, Poppins (not Nova on site if product is Poppins), pricing $4.99 / $48. |
| **A2** | Auth emails via Resend | Wire `emails/verification`, `password-reset`, `magic-link`, `email-changed` into `supabase/functions/send-auth-email` (or Custom SMTP — not both). Live test: signup → branded verify → `choremaxx://auth/callback`. Docs: `docs/email-templates.md`, `docs/resend-auth-email.md`. |
| **A3** | IAP scaffold | StoreKit / `expo-iap` (or RevenueCat if already chosen) scaffold for Premium: 7-day trial, $4.99/mo, $48/yr. Products created in ASC. Entitlement gate stub in app (no fake “paid” UI). No billing emails yet (B5). |
| **A4** | Rewards smoke | End-to-end on staging Supabase: mint reward → claim/ask → approve → ledger shows Waiting/Approved; allowance Mark as paid → ledger Owed/Paid. Special ask path (Q1=B) when admin allows. |
| **A5** | Notifications foundation | Closed registry `constants/notifications.ts` already exists — wire delivery prefs toggles, quiet hours 21:00–07:00, batching (Rev D §5 / Rev E §2.5), no Recess spam. Push categories match registry IDs. |
| **A6** | Poppins OpenAI connect | Edge function + `EXPO_PUBLIC_POPPINS_AI=openai` on TestFlight profile already — verify live answers from Poppins tab with household context; no invented tools. |
| **A7** | Account matrix | Matrix doc or checklist: parent/admin, helper/child, shared tablet — create/join household, roles, child-safe surfaces. Fix any broken path found. |
| **A8** | Store package draft | ASC listing draft: name, subtitle, description, keywords, screenshots plan, privacy URL, support URL, age rating notes. Do **not** submit for review until B7. |

### Phase B — craft

| ID | Task | Done when |
|----|------|-----------|
| **B1** | Poppins as craft | Poppins feels like a household co-manager (suggestions, tone) not a generic chatbot — grounded in product-context + existing tools only. |
| **B2** | Poppins itineraries | Poppins can help create/adjust Plan itineraries within existing Plan/calendar models. |
| **B3** | Notification actions | Approve / proof / reward actions from notifications where platform allows; deep links land on the right screen. |
| **B4** | Site payment gates | Marketing site CTAs match IAP reality (trial + Premium); remove roommate-mode promises that contradict Master Brief; soft-gate “Download” vs paywalled features copy. |
| **B5** | Billing emails | Wire billing templates only after A3 products exist; Resend from Apple/server webhook — no fake charges. |
| **B6** | Full retest | Checklist: auth → household → tasks/XP → Plan → Rewards/allowance ledgers → Poppins → House Rules → Recess/Rescue → push. Expo Go + TestFlight. `npm run test:logic` + Rev D/E/house-rules suites green. |
| **B7** | App Review submit | Only after B6 green + A8 complete + legal URLs live. Submit ASC for review. |

---

## Automation prompt (paste into Cursor Automation)

```
You are shipping ChoreMaxx for App Store readiness.

BRANCH (mandatory):
- git fetch && git checkout cursor/choremaxx-make-v9-5f8f && git pull
- Commit and push ONLY on this branch. Do not create cursor/*-c30d sprawl.

READ FIRST:
- docs/weekend-ship-automation.md  (this playbook — Phase A then Phase B)
- docs/logic/choremaxx-MASTER-BRIEF.md §3 (wins all conflicts)
- docs/product-context.md, docs/technical-blueprint.md
- docs/testflight-setup.md, docs/email-templates.md, docs/resend-auth-email.md

HARD RULES:
- Do not invent features. Do not re-port Figma Make.
- Poppins in product strings (not Nova) per Master Brief.
- Families only — no roommate mode in shipping product.
- Allowance never sends money — Mark as paid / Approve now.
- Pricing: 7-day trial, $4.99/mo, $48/yr via Apple IAP.
- Prefer Expo Go for UI checks; use TestFlight/supabase for store paths.
- After each phase slice: commit, push, OTA to channel testflight (+ august-6 if that channel is still in use).
- Fill a short completion report per A/B item (pass/fail + what you skipped).

EXECUTE IN ORDER:
1. Phase A1 → A8 completely.
2. Then Phase B1 → B7.
3. Stop and report if blocked on secrets (Resend API key, OpenAI, ASC IAP products, EAS iOS build quota).

START: Confirm branch tip SHA, then begin A1.
```

---

## Tomorrow morning checklist (human)

1. Open TestFlight — confirm build **21+** (or latest) installs; force-quit once to pull OTA if needed.
2. Confirm EAS iOS build quota / plan if build **21** did not queue (Free plan monthly limit may block).
3. Paste the [Automation prompt](#automation-prompt-paste-into-cursor-automation) into a Cursor Automation **or** start an Agent on v9 with: *Execute docs/weekend-ship-automation.md Phase A then B*.
4. Have ready: Resend API key, OpenAI key in Supabase secrets, ASC access for IAP products, site repo URL if marketing lives outside Orbit.

---

## Related docs

- [next-session.md](./next-session.md) — older 3-item list; **superseded for weekend ship by this file** (keep for website domain notes)
- [testflight-setup.md](./testflight-setup.md)
- [email-templates.md](./email-templates.md)
- [logic/choremaxx-MASTER-BRIEF.md](./logic/choremaxx-MASTER-BRIEF.md)
