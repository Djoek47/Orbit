# make-v32 launch audit

**Branch tip:** `cursor/make-v32`  
**Purpose:** Final polish pass — code, security, UI, logic — plus a map so future humans/AIs can ship safely.

This is the living checklist for “ready for TestFlight” vs “ready for public App Store”.

---

## 1. Logic audit (product flows)

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

### CRITICAL — fix before public App Store (staging may already be exposed)

1. **`household_invites` SELECT `or true`** — world-readable invite codes  
   `supabase/migrations/20260715000000_orbit_foundation.sql`
2. **`members_insert` allows any auth user into any household** (`user_id = auth.uid()`)
3. **Members may escalate `role` via UPDATE** without admin gate
4. **`token_grants` client INSERT + `grant-token-pack` without StoreKit verify** — free credits

### HIGH
5. Tables without RLS (itineraries, xp ledger, recess, …) — enable RLS + policies  
6. `generate_member_invite` security definer without admin check  
7. Profile-code Sidekick edge paths = capability URL (service role)  
8. Keys once pasted in agent terminals — **rotate** (see checklist)  
9. `POPPINS_VOICE_GRANT_ALL` must be unset in production  

### MEDIUM
10. Deep-link tokens in query strings (OS logs / screenshots)  
11. Review demo credentials committed (`lib/auth/review-demo.ts`) — rotate after ASC review  
12. Weak household join codes (`Math.random`, 6 digits)  

---

## 5. Key / password rotation checklist (names only)

Rotate in dashboards **before public launch** if ever shared in chat/terminals/CI logs:

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
| App Review demo password | `REVIEW_DEMO_*` / ASC notes |
| Confirm `POPPINS_VOICE_GRANT_ALL` ≠ `1` on prod |

**Do not paste secret values into git, PRs, or agent chats.**

---

## 6. Final-shape backlog (priority)

### P0 — before App Store (not blocking private TestFlight)
- [ ] Ship RLS migrations for CRITICAL items 1–4  
- [ ] StoreKit verify in `grant-token-pack`; revoke client grant writes  
- [ ] Rotate secrets in checklist  
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

Private TestFlight can validate UX on `make-v32` while RLS migrations land on staging in parallel.
