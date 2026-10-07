# make-v32 launch audit

**Branch tip:** `cursor/make-v32`  
**Purpose:** Final polish pass — code, security, UI, logic — plus a map so future humans/AIs can ship safely.

This is the living checklist for “ready for TestFlight” vs “ready for public App Store”.

---

## 1. Logic audit (product flows)

**Full house-rules logic audit:** [`docs/logic/LOGIC_AUDIT_V32.md`](./logic/LOGIC_AUDIT_V32.md) (create → assign → edit/reassign → complete → proof → late/expiry → streaks → shared-device → rewards). Open product questions are in §13 of that doc.

| Flow | Status | Notes |
|------|--------|--------|
| Admin / Sidekick sign-out | **PASS** | Native confirm → dismiss Settings → `signOutAndLeave` → root Signing-out cover → Get Started |
| Shared-device sign-out | **PASS** | Presence disconnect + “Sign this device out” copy |
| Privacy & legal | **PASS*** | Root glass sheet; Settings dismissed first so Modal is not nested |
| Get Started (Help) | **PASS** | Dismisses Settings → Home checklist forced visible |
| My Subscription | **PASS** | Effective / Expiration dates; inactive shows `$6.99/mo · $49.99/yr (40% off)` |
| Mock token buy | **PASS** | Packs append; Settings/Credits refresh via `notifyTokenGrantsChanged` |
| Jack/Emma accents | **PASS** | Coral / Citrus; Switch + Who’s on + tab Switch follow person |
| Sign-in | **PASS** (prior) | Email confirm + review demo path unchanged this pass |
| Admin task reassign | **PASS** | Who in Edit; grace night + next day full XP; this-occurrence; streak-safe |
| Streak cliffs / Rescue | **WIRED** | Rollover → `applyRolloverStreaksForDay`; validate on device over real days |

\*Hardened in the audit polish commit: Privacy now calls `closeSettingsModal()` before opening the legal sheet.

---

## 2. UI / usability audit

### What looks final
- Shared-device Switch menu (Home) and tab Switch button — person accent on the FAB
- Tasks Who’s on — chrome recolors to viewed kid
- Settings leave / Sign out cover — calm, blocks taps while wiping
- Pricing copy locked to catalog

### Remaining polish (non-blocking for TF)
1. Other Settings `orbitAlert`s (Replay a part, Restore, hygiene) still nest Modals — migrate to native menus over time
2. Settings Help/Choremaxx icon colors are fixed domain hues, not person accent
3. `BrandLegalFooter` link color uses `orbitColors.primary`, not active accent
4. Long Settings scroll — consider section search later
5. Expo Go mock shared tablet is now **Emma + Jack** (was Josh + Todd)

---

## 3. Code audit & contributor map

### Where work lives

| Concern | Primary paths |
|---------|----------------|
| Auth / leave | `lib/auth/sign-out-and-leave.ts`, `local-sign-out.ts`, `reset-to-get-started.ts` |
| Settings UI | `app/settings.tsx`, `components/orbit/sidekick-settings-screen.tsx` |
| Native menus | `lib/ui/settings-native-menus.ts`, `legal-links-sheet-controller.ts` |
| Legal browser | `lib/legal/open-choremaxx-url.ts`, `components/orbit/settings/legal-links-sheet-host.tsx` |
| Person accents | `lib/theme/member-accent.ts` ← Jack/Emma source of truth |
| Billing / tokens | `constants/billing.ts`, `lib/billing/iap.ts`, `token-grants.ts` |
| Store | `store/orbit-store.tsx` (huge — prefer helpers over new inline logic) |
| Edge / RLS | `supabase/migrations/*`, `supabase/functions/*` |

### Rules for future agents
1. **Only push `cursor/make-v*`** — tip is `make-v32`. Never invent `cursor/*-c30d` ship branches.
2. **Never nest RN `Modal` / `orbitAlert` under Expo Settings `presentation: 'modal'`** — dismiss Settings first, or use ActionSheet/Alert.
3. **Person chrome** → `resolveMemberAccentTheme` / `resolveMemberAccentColor`, not hardcoded oranges.
4. **Prices** → only `constants/billing.ts` (`subscriptionPriceLine()`).
5. **Mock token buys** must go through `purchaseTokens` → `grantTokenPack` (never silent no-persist returns).
6. Prefer multipass tests next to the feature (`*-multipass.test.ts`, `member-accent.test.ts`).

### Annotation convention (lightweight)
- Module top comment = *why* + *do not nest / do not invent branch*
- Dangerous paths already tagged (`sign-out-and-leave`, `settings-native-menus`, `member-accent`)
- Do **not** add noisy per-line comments; document contracts in `lib/**/*.ts` headers and this file

---

## 4. Security audit

### Already OK
- No live API keys found in tracked source; `.env` gitignored
- Client only sees `EXPO_PUBLIC_*` (anon key, URLs, flags)
- Sign-out wipes SecureStore session + blocks auth storage writes
- Pending signup password cleared on local wipe (audit polish)
- Realtime voice designed not to ship long-lived OpenAI keys to the device

### CRITICAL — shipped in repo (apply on staging)

Migration: `supabase/migrations/20261006013743_security_harden_rls_v32.sql`  
Edge: `supabase/functions/grant-token-pack` (auth + admin membership)

1. **`household_invites` SELECT** — members only (removed `or true`); join uses service role  
2. **`members_insert`** — admin or bootstrap owner (`households.owner_id = auth.uid()`, role `owner`)  
3. **Role/status lock trigger** — non-admins cannot escalate membership  
4. **`token_grants`** — no client INSERT; consume-only UPDATE trigger; edge requires admin JWT  

Still open before **public** App Store (not blocking held TestFlight): StoreKit server verify inside `grant-token-pack`.

### HIGH
5. ~~Tables without RLS~~ — enabled in same migration (itineraries, stops, templates, xp ledger, streak, day, recess, crown, monitor cursor)  
6. ~~`generate_member_invite`~~ — admin gate added in same migration  
7. Profile-code Sidekick edge paths = capability URL (service role)  
8. Keys once pasted in agent terminals — **rotate later** (see `docs/key-rotation-checklist.md`)  
9. `POPPINS_VOICE_GRANT_ALL` must be unset in production  

### MEDIUM
10. Deep-link tokens in query strings (OS logs / screenshots)  
11. ~~Review demo credentials in app~~ **removed** — use a real Supabase Auth user in ASC notes only
12. Weak household join codes (`Math.random`, 6 digits)  

---

## 5. Key / password rotation checklist (names only)

**Full list:** `docs/key-rotation-checklist.md` — rotate later; no values in git/chats.

| Secret | Where |
|--------|--------|
| `OPENAI_API_KEY` | Supabase Edge secrets |
| `RESEND_API_KEY` | Supabase / Auth SMTP |
| `SEND_EMAIL_HOOK_SECRET` | Auth hook + Edge |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project |
| `SUPABASE_ANON_KEY` | if ever leaked with broken RLS |
| `EXPO_TOKEN` / EAS credentials | Expo |
| `SUPABASE_ACCESS_TOKEN` | CLI / agents |
| Apple `.p8` Sign In key | Apple Developer |
| App Review demo password | Supabase Auth user / ASC notes only |
| Confirm `POPPINS_VOICE_GRANT_ALL` ≠ `1` on prod |

---

## 5b. EAS / Apple TestFlight readiness (verified 2026-10-06)

| Check | Result |
|-------|--------|
| `eas whoami` | `djoek47` authenticated (`EXPO_TOKEN`); owner of `choremaxx-team` |
| Project | `@choremaxx-team/choremaxx` (`01af7128-865e-4d2e-b0b1-836f03105fc8`) |
| Bundle id | `app.choremaxx.household` |
| Profile `testflight` | Present in `eas.json`; `ascAppId` `6796850110`; store distribution |
| EAS env (production) | Loads `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, privacy/terms URLs |
| Remote iOS buildNumber | **110** (next build auto-increments) |
| Recent TF builds | **110 / 109 / 108** finished successfully (not `make-v32` tip) |
| Interactive credentials UI | Not usable non-interactively in this agent; prior finished builds imply Apple creds are already on EAS |

**Verdict:** EAS + Apple pipeline is ready to build/submit when you say so. **Held — do not push TestFlight until you ask.** Apply RLS migration on staging before or with the next TF cut.

---

## 6. Final-shape backlog (priority)

### P0 — before App Store (not blocking private TestFlight)
- [x] Ship RLS migrations for CRITICAL items 1–4 (in repo; **apply on staging**)  
- [x] Revoke client grant INSERT + authZ on `grant-token-pack`  
- [ ] StoreKit verify in `grant-token-pack`  
- [ ] Rotate secrets in checklist (later)  
- [ ] Production voice grant off  

### P1 — next Make line
- [ ] Migrate remaining Settings `orbitAlert`s to native menus  
- [ ] Stronger invite entropy + admin-only mint RPC  
- [ ] Website legal URLs live + monitored (Privacy freeze was partly site-down)  

### P2 — polish
- [ ] Person accent on Settings domain icons / footer links  
- [ ] Contributor CONTRIBUTING.md pointing at this audit + AGENTS.md  

---

## 7. TestFlight vs production

| Gate | TestFlight (internal) | App Store public |
|------|----------------------|------------------|
| make-v32 product polish | Required | Required |
| CRITICAL RLS | Strongly recommended on staging | **Required** |
| Key rotation | Recommended if keys leaked | **Required** |
| StoreKit live | Optional (mock OK) | Required |

**Status:** Private TestFlight **authorized** from tip `cursor/make-v32`. Aggregate audit: `docs/make-v32-three-day-audit.md`.
