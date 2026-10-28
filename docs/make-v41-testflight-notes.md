# make-v41 TestFlight — release notes (build 131)

**Branch tip:** `cursor/make-v41-c30d`  
**Base:** make-v40 / TF **129**; TF **130** = App Review only (in flight or finished)  
**Status:** Patches 0002–0007 on tip. **TF 131 canceled** — hold until user says push TestFlight. TF **130** (App Review) finished.

## What's in this build

### Already on tip (TF 130)
- App Review 2.5.4: no unused background modes
- App Review 5.1.2(i): Poppins OpenAI consent sheet + `ai_consent_at`

### Patches 0002–0007 (this cut)
- iPad: tour Exit in card, square QR scanner, square category tiles, house rules no overlap
- No Itineraries / Smart Trips / Poppins for Sidekicks or shared devices (server refuses shared too)
- iPad: full-bleed width; sign-in glow no longer cuts the form
- Sign-in: show/hide password, input checks, new-device security emails (`login-alert` + `login_devices`)
- Shared devices: demo people (Emma/Jack) never appear on a real account
- No pushes / local reminders once trial or subscription has ended (billing notices still go)

### Staging
- `ai_consent` + `login_devices` migrations applied
- Edge: `login-alert` v1, `dispatch-member-push` v10, Poppins suite redeployed (shared-device + consent)

## Matrix
| Check | Result |
|-------|--------|
| `git am` 0002–0007 (0001 already on tip) | OK |
| `tsc --noEmit` | OK |
| credential-input, real-members-only, layout-metrics | PASS |
| testflight:preflight | PASS (HaveIBeenPwned warn unchanged) |

## Cut
| | |
|--|--|
| Version | **1.3.0 (131)** |
| Branch | `cursor/make-v41-c30d` |
| PR | https://github.com/Djoek47/Orbit/pull/129 |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/4d17c6b3-3fe5-4420-ae6e-d265ba69fd26 |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/960043de-ab79-4696-b1e6-5e94b0b0adf9 |
| Prior (130) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/a07537fa-628e-4363-be7b-71cfc08548f3 |
