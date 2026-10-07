# make-v36 TestFlight — release notes & fold audit (build 121)

**Branch tip:** `cursor/make-v36-c30d`  
**Base:** make-v35 / TestFlight **1.3.0 (120)** @ `67faa2e`  
**Data:** staging Supabase (`dejrbyufotcvcillnneo`)  
**Status:** Prepped locally — **do not push / cut TF until user says go.**  
**Ops checklist:** `docs/build-121-release-checklist.md` (Supabase migrate + functions **before** anyone installs 121).

---

## Aggregation — what’s in 121 (on top of 120)

### A. Household Premium + payment gate (v34-06)
- Household-level entitlement (`households.premium_*` migration + `sync-entitlement`)
- App gate: unpaid admin → paywall; Sidekick / shared tablet → locked screen (no buy button)
- Trial: Poppins on bought credits only; monthly 300 after convert
- Packs: 200 / 700 / 2000 (`grant-token-pack`)
- Escape hatch on paywall: **Account** sheet (restore, support, legal, transfer/delete, sign out)
- Trial countdown in Activity inbox

### B. iPad / layout (v34-06)
- One centred column (`AppColumn` + layout metrics) for iPad, Split View, iPhone Duo letterbox
- Orientation support retained for iPad

### C. Public URL cutover
- All shipping URLs → `www.choremaxx.app` (no `vercel.app`)

### D. Apple Review auth
- Removed in-app review-demo autofill / hardcoded tester login
- Reviewers use a real Supabase Auth account listed in ASC only

### E. ASC product-page creatives
- Header + search PNGs (5244×2950, etc.)
- Header: compact lockup in dark band, no glow disc
- Search: clear ambient light background, same lockup, no logo glow  
  Upload: `store/screenshots/asc-product-page/search-5244x2950.png`

### F. Shared devices — one way in (v34-07) ← latest patch, applied exactly
- QR scanner passes multi-code shared-device links whole (no first-code truncate)
- Wizard persists the new device into links (People no longer empty)
- Personal CMX on a shared device → same Welcome card / join-shared-device as the device QR
- Join saves a session for **every** code on the invite; one stale code does not block the rest
- Public lookup names people on the device; never returns others’ codes (security: one child’s
  code must not unlock siblings). On a **brand-new tablet**, one CMX → **one face** that opens.
  Full roster = device QR from **People → Show the code**.
- Shared-tablet sign-out keeps the device; Welcome offers “Continue with \<house\> shared device” → faces
- Fuller Sidekick / shared-tablet tour (day, jobs, homework, grocery, ranks, rewards, rules, Switch)
- **Staging:** `redeem-profile-invite` redeployed (ahead of TF push)

---

## Audit — 120 → 121 (multi-pass)

| Pass | Check | Result |
|------|--------|--------|
| 1 | Branch is `cursor/make-v36-c30d`, clean tip, **not pushed** | OK |
| 2 | v34-07 files match patch postimage (17/17 reconstructable; store has all `+` lines) | OK |
| 3 | `review-demo` module gone; no autofill path | OK |
| 4 | No `vercel.app` in app/code paths | OK |
| 5 | ASC search PNG light ambient (lum ≈ 241); headers PNG-only | OK |
| 6 | Tests: one-flow, welcome, multipass, tour-steps (83), payment-gate, entitlement, layout-metrics | PASS |
| 7 | Ops not in binary: Supabase push + function deploy + ASC IAP readiness | **User / staging** — see checklist |
| 8 | New menus / gates reviewed (below) | OK |

### Known, not blockers for this cut
- App Store Server Notifications deferred (renewals sync when admin opens app)
- `sync-entitlement` trusts admin JWT, not Apple JWS yet
- Two pre-existing test failures noted in checklist (`invite-intent`, `revision-e` env) — not introduced by v34-06/07

---

## New menus / surfaces review

| Surface | Who sees it | Verdict |
|---------|-------------|---------|
| **Account escape sheet** (paywall → Account) | Unpaid admin | OK — restore, support, Terms/Privacy, transfer/delete household (owner), delete account, sign out. Outside tab gate. |
| **Household locked screen** | Sidekick / shared tablet when Premium lapsed | OK — no purchase CTA; names admin; Check again / Switch / Sign out |
| **Poppins trial lock** | Trial household on Poppins tab with no bought credits | OK — explains bought-actions path |
| **Trial countdown card** | Activity inbox during trial | OK — informational |
| **Join shared device Welcome card** | Device QR **or** forwarded personal CMX | OK — one way in; Join binds all codes; optional “use as \<name\>’s own” → `join-profile?own=1` |
| **Welcome — Continue with shared device** | After shared-tablet sign-out | OK — resumes faces, not one child |
| **Sidekick / family_ipad tour chapters** | First-run Sidekick & shared tablet | OK — no money/assign/Poppins; ends with Switch / pass-on |
| **Premium paywall** (existing, gated harder) | Admin only | OK — household pays once |

No stray “Which device?” chooser on join-profile. Personal join stays for `own=1` and non-shell codes only.

---

## Release notes (ASC / TestFlight) — draft

make-v36 is the Premium + shared-device fold after TF 120. The household pays once and every device unlocks together; unpaid Sidekick phones stay locked without a buy button. Shared tablets join one way (device QR or a person’s code), every face opens, and signing out resumes the house. Product-page search art is on a clear ambient light field. Please exercise Premium paywall / trial / Sidekick lock, shared-tablet join + Switch + resume, and iPad column layout.

---

## Cut checklist (when you say go)

1. [x] Fold v34-06 payments/iPad + URL cutover + review-demo removal + ASC creatives + v34-07 one-flow
2. [x] Multi-pass audit; menus OK
3. [x] Staging: `redeem-profile-invite` redeployed
4. [x] Staging: `sync-entitlement` + `grant-token-pack` (200/700/2000) redeployed
5. [x] Staging: `20261007120000_household_premium.sql` applied (8 `premium_*` columns)
6. [x] Payment final pass (see below) — code ready; ASC product Apple-verify still pending
7. [ ] ASC: products attached to 1.3.0 / Apple clears review (user) — packs show **Soon** until StoreKit lists them
8. [x] **Push `cursor/make-v36-c30d` + EAS TestFlight 1.3.0 (121)** — queued
9. [ ] Seed review household Premium in SQL; put real ASC review credentials

| | |
|--|--|
| Version | **1.3.0 (121)** — make-v36 |
| Branch | `cursor/make-v36-c30d` |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/9d650e20-249f-4214-ae59-67b73434b9b2 |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/b3ced264-4df1-4d2a-a2f6-e139daef891c |
| PR | https://github.com/Djoek47/Orbit/pull/124 |
| Prior (120) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/fbf0926f-6f4a-4d9e-89ba-7947b2c8b653 |

### Payment final pass (build 121)

| Check | Result |
|-------|--------|
| SKUs match ASC ids character-for-character (`monthlyv` / `yearlyv` / `tokens.{small,medium,large}v`) | OK in `constants/billing.ts` + both edge functions |
| Client ↔ server pack sizes 200 / 700 / 2000 | OK (`pack-parity`); `grant-token-pack` redeployed |
| Household Premium columns + server-only trigger | OK on staging |
| Gate: paid / trial (Poppins locked, packs unlock) / locked (kids: no buy CTA) | OK |
| Credits UI: StoreKit probe → unlisted SKUs show **Soon** (not a crash) | OK — expected until Apple verifies e.g. `…tokens.smallv` |
| `sku_not_found` on purchase if Apple has not listed the product yet | Expected; not a binary bug |
| JWS / App Store Server Notifications | Deferred (known); renewals sync when admin opens app |

