# make-v41 TestFlight — release notes (next cut after hold)

**Branch tip:** `cursor/make-v41-c30d`  
**Base:** make-v40 / TF **129**; TF **130** = App Review only (finished)  
**Status:** Patches **0002–0009** + OpenAI **0004** + receipts **0005** + Household Health **0001** on tip. **HOLD TestFlight** until user says go for the next build. TF **131** was cut then canceled — do not ship until explicit go.

## What's on tip (ready for next TF when allowed)

### Already shipped (TF 130)
- App Review 2.5.4: no unused background modes
- App Review 5.1.2(i): Poppins OpenAI consent sheet + `ai_consent_at`

### Patches 0002–0007
- iPad: tour Exit in card, square QR scanner, square category tiles, house rules no overlap
- No Itineraries / Smart Trips / Poppins for Sidekicks or shared devices (server refuses shared too)
- iPad: full-bleed width; sign-in glow no longer cuts the form
- Sign-in: show/hide password, input checks, new-device security emails (`login-alert` + `login_devices`)
- Shared devices: demo people (Emma/Jack) never appear on a real account
- No pushes / local reminders once trial or subscription has ended (billing notices still go)

### Patches 0008–0009 (shared devices final)
- **0008** Invited Sidekicks can join a tablet; device needs **two+** people to run; **one device per person**; shared copy/rules in `lib/household/shared-device-rules.ts` (setup wizard, manage card, People nesting)
- **0009** Go-live: Sidekick phones + shared tablets check in every **8s** (and on app resume); phone signs out with “You’re on … now”; device under two / removed signs out with reason; roster change shows `DeviceUpdatedNotice` (“Your admin updated this device”); XP/streaks stay on the member

### OpenAI permission 0004 (Settings switch)
- Settings **Poppins uses OpenAI** is an on/off `SettingsToggleRow` (no sheet-over-Settings that left a tap blocker)
- Consent sheet is one sentence + Privacy policy link (still opens via `requestAiConsent` when needed)
- `CHOREMAXX_LEGAL` privacy/terms ignore env URLs not on `choremaxx.app` (blocks stale Vercel preview)

### Receipts / tokens 0005
- Credit + subscribe receipts / confirmations use **Apple’s localized price** (`priceLabel` / `storePrices.display`), not the built-in USD catalog
- Pack cards + out-of-tokens sheet say **tokens** (not “actions”)
- `createProfile` also writes `full_name` / `name` / `display_name` into auth user metadata; staging backfill migration `auth_names_from_profiles`

### Household Health 0001
- `taskState`: past-day jobs are **expired** even if status still says Pending
- `isOpenTask` = finishable now (expired ≠ open) — Health, kid Home, Poppins, daily insight
- Completion score = last 7 days done ÷ (done + missed); popover: Score / Done / Missed / Open now

### Staging
- `ai_consent` + `login_devices` migrations applied
- `auth_names_from_profiles` applied (Users list shows profile names)
- Edge: `login-alert` v1, `dispatch-member-push` v10, Poppins suite redeployed (shared-device + consent)

## Matrix (0008–0009 + OpenAI 0004 + receipts 0005)
| Check | Result |
|-------|--------|
| `git am` 0008 + 0009 on tip | OK (`c9c1595`, `2237501`) |
| `git apply --reverse --check` 0008 + 0009 | OK (fully applied) |
| `git am` OpenAI permission 0004 | OK (`8eaecb2`) |
| `git apply --reverse --check` 0004 | OK |
| `tsc --noEmit` | OK |
| `shared-device-rules` / readiness / member-card-status / switch / welcome / one-flow | PASS |
| settings-signout multipass (15) | PASS |
| billing IAP (11) | PASS |
| `open-choremaxx-url` legal defaults | PASS |
| Spot: min 2 people, invited OK, one device/person | OK (rules + setup + manage card + store links) |
| Spot: 8s check-in + AppState resume → `applyDeviceTransition` | OK (`store/orbit-store.tsx`) |
| Spot: go-live notice copy | OK (`deviceTransition` → `deviceNotice` → `DeviceUpdatedNotice`) |
| Spot: `closeDevice` wipe on device-closed | OK |
| Spot: Settings OpenAI toggle (no sheet-over-Settings) | OK |
| Spot: consent sheet one-line + privacy link | OK |
| Spot: non-choremaxx.app legal env rejected | OK |
| `git am` receipts/tokens 0005 | OK (`0c8fca9`) |
| `git apply --reverse --check` 0005 | OK |
| topup-receipt (+ CA$ priceLabel) / IAP | PASS |
| Spot: pack UI “tokens”; buy paths pass `priceLabel` | OK |
| Staging `auth_names_from_profiles` | Applied |
| TestFlight | **HOLD** — wait for user |

## Prior canceled cut (do not reuse)
| | |
|--|--|
| Version | **1.3.0 (131)** — canceled |
| Branch | `cursor/make-v41-c30d` |
| PR | https://github.com/Djoek47/Orbit/pull/129 |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/4d17c6b3-3fe5-4420-ae6e-d265ba69fd26 |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/960043de-ab79-4696-b1e6-5e94b0b0adf9 |
| Prior (130) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/a07537fa-628e-4363-be7b-71cfc08548f3 |
