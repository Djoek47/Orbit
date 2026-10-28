# make-v41 TestFlight — release notes (build 133)

**Branch tip:** `cursor/make-v41-c30d`  
**Base:** TF **132** (1.3.0) on ASC  
**Status:** **1.3.0 (133)** cut + ASC auto-submit. Adds Poppins counter **0002** + tokens wording **0003** (+ leftover copy fix).

## What's new since 132
- **0002** Poppins chip/orb use `tokensRemaining` (month ∩ day + bought packs) — pack buys no longer show “300 LEFT”
- **0003** One word: **tokens** (not actions) on paywall, paused line, settings panel, tour, premium top-up, Android channel, meter “NO TOKENS USED”
- Cross-check fix: paused Speak copy + out-of-tokens sheet “tokens available”

## Still in from 132
- Shared devices 0008–0009, OpenAI Settings switch 0004, receipts 0005, Household Health 0001, App Review TF 130

## Matrix (0002 + 0003 → TF 133)
| Check | Result |
|-------|--------|
| 0002 already on tip (reverse-check) | OK (`f41a0d1`) |
| `git am` 0003 | OK (`bbe2cfb`) |
| Cross-check leftover “actions” UI | Fixed paused copy + out-of-tokens label (`7350b70`) |
| `tsc` | OK |
| access-gate / act-events / allowance / topup-receipt / IAP / week-completion / shared-device-rules / legal | PASS |
| testflight:preflight | PASS (HaveIBeenPwned warn unchanged) |

## Cut
| | |
|--|--|
| Version | **1.3.0 (133)** |
| Branch | `cursor/make-v41-c30d` |
| PR | https://github.com/Djoek47/Orbit/pull/129 |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/67e525c3-d9dd-4b3f-869c-5a5782208955 |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/452e18b7-b087-4e70-9ea1-97a2cafeb32f |
| Prior (132) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/8a803498-df65-4797-b889-f43a0f937de9 |
