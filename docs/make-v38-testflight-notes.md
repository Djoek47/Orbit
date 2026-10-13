# make-v38 TestFlight — release notes (build 126)

**Branch tip:** `cursor/make-v38-c30d`  
**Base:** make-v37 / TF **1.3.0 (125)**  
**Package:** `build-126-package` patches 0004 + 0006–0012 (0001–0005 already on tip)  
**Design ref:** `design/paywall/paywall-previews.html` (uploaded ChoreMaxx Paywall Previews)  
**Console zip:** deferred (not in this cut)

---

## What's in this build (on top of 125)

- Payments: recover unfinished purchases, Apple grace period, no unconfirmed trial promise, clearer restore
- Calendar holidays: 7 regions, 56 days, Holiday settings
- Halloween theme **OFF** until `HALLOWEEN_RELEASED = true` (auto-off Nov 1)
- Lighter paywall with motion, pulsing savings badge, ChoreMaxx wordmark on free-trial, friendly payment-error cards
- Console SQL fix (per-day error series) — already applied on staging earlier where needed

---

## Matrix pass

| Check | Result |
|-------|--------|
| `git am` 0004 + 0006–0012 | OK |
| `HALLOWEEN_RELEASED === false` | OK |
| `tsc --noEmit` | OK |
| billing suite + premium-ui + holidays + seasonal | PASS |
| testflight:preflight | PASS (HaveIBeenPwned warn unchanged) |
| Console zip | **Not pushed** |

---

## Cut

| | |
|--|--|
| Version | **1.3.0 (126)** |
| Branch | `cursor/make-v38-c30d` |
| PR | https://github.com/Djoek47/Orbit/pull/126 |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/75c6c07a-304f-43d7-89c9-533244c83439 |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/7e2e4408-1778-4c7b-a07a-a067a2c77f03 |
| Prior (125) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/23e0cb50-dbf5-4c1e-8b35-b5ce48550a11 |
