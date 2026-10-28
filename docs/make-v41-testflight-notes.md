# make-v41 TestFlight — release notes (build 132)

**Branch tip:** `cursor/make-v41-c30d`  
**Base:** make-v40 / TF **129**; TF **130** = App Review only (finished)  
**Status:** **1.3.0 (132)** cut + ASC auto-submit in flight. Includes shared devices 0008–0009, OpenAI Settings switch 0004, receipts/tokens 0005, Household Health 0001. TF **131** was canceled earlier.

## What's in this build

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
- **0008** Invited Sidekicks can join a tablet; device needs **two+** people to run; **one device per person**; shared copy/rules in `lib/household/shared-device-rules.ts`
- **0009** Go-live: Sidekick phones + shared tablets check in every **8s** (and on app resume); phone signs out with “You’re on … now”; device under two / removed signs out with reason; roster change shows `DeviceUpdatedNotice`

### OpenAI permission 0004 (Settings switch)
- Settings **Poppins uses OpenAI** is an on/off `SettingsToggleRow`
- Consent sheet is one sentence + Privacy policy link
- `CHOREMAXX_LEGAL` privacy/terms ignore env URLs not on `choremaxx.app`

### Receipts / tokens 0005
- Credit + subscribe receipts use **Apple’s localized price**
- Pack cards + out-of-tokens sheet say **tokens**
- `createProfile` writes auth user metadata names; staging `auth_names_from_profiles`

### Household Health 0001
- Past-day jobs count as expired even if status still says Pending
- `isOpenTask` = finishable now across Health / kid Home / Poppins / daily insight
- Completion score = last 7 days done ÷ (done + missed)

### Staging
- `ai_consent` + `login_devices` + `auth_names_from_profiles` applied
- Edge: `login-alert` v1, `dispatch-member-push` v10, Poppins suite redeployed

## Cut
| | |
|--|--|
| Version | **1.3.0 (132)** |
| Branch | `cursor/make-v41-c30d` |
| PR | https://github.com/Djoek47/Orbit/pull/129 |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/8a803498-df65-4797-b889-f43a0f937de9 |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/5f2ec7db-aa50-44c2-a598-0cb4e4098192 |
| Prior canceled (131) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/4d17c6b3-3fe5-4420-ae6e-d265ba69fd26 |
| Prior (130) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/a07537fa-628e-4363-be7b-71cfc08548f3 |
