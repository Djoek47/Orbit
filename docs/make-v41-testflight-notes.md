# make-v41 TestFlight — release notes (build 131)

**Branch tip:** `cursor/make-v41-c30d`  
**Base:** make-v40 / TF **129**; TF **130** = App Review only (in flight or finished)  
**Status:** **1.3.0 (131)** build queued + ASC auto-submit scheduled.

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
| testflight:preflight | (at cut) |

## Cut
| | |
|--|--|
| Version | **1.3.0 (131)** |
| Branch | `cursor/make-v41-c30d` |
| PR | https://github.com/Djoek47/Orbit/pull/129 |
| Build | (fill) |
| Submit | (fill) |
