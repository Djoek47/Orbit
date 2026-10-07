# make-v35 TestFlight — release notes & tester brief

**Branch tip:** `cursor/make-v35-c30d`  
**Base:** make-v34 fold (TF 119) + Claude `choremaxx-v34-all` + `v34-05-review-switch-live`  
**Data:** staging Supabase (`dejrbyufotcvcillnneo`)  
**Status:** Final pre-Apple cut candidate — build **1.3.0 (120)** after multi-pass audit.

---

## What’s in this build (on top of make-v34 / TF 119)

### Claude v34-all (already on tip)
- Shared-device welcome confirmation (not “Which device?”)
- Paywall / unpaid gating + plain-language copy

### v34-05 review-switch-live
- Welcome card recovers after failed join
- Join creates session before face picker (no admin password trap)
- Match code only when real (from invite household id)
- Readiness counts the same people as the wizard grid (`role === 'child'`)
- Face tap latch is a ref (two-finger safe)
- **Switch mark Variant B** — people as dots in a clockwise ring (2–6), thicker brownish strokes
- Day rollover on open / return / midnight (stable, not every Home tick)
- Today’s Tasks freshness line + tap to refresh (icon spins)
- Nearby suggestions paint last-shown first; cache geocoded Home origin

### Hardening after audit (this cut)
- `useDayRollover` refs so open does not re-fire every store render
- `completeProfileJoin` returns members; tablet bind uses post-join roster
- Invite `householdId` drives match code (not mock Rivera)
- Welcome subtitle gated when code is hidden

---

## Release notes (ASC / TestFlight)

make-v35 is the Switch + shared-device polish cut before Apple. Shared tablets welcome you instead of interrogating you; the Switch tab shows the people on the device as a ring you pass around; Home rolls the day overnight without a pull; Near home stops spinning every open. Please exercise shared-tablet Accept + Switch, Home overnight/freshness, and Poppins voice once more.

---

## Cut checklist

1. [x] Apply v34-05 patch on make-v35
2. [x] Multi-pass logic + UI audit; blockers fixed
3. [x] EAS TestFlight 1.3.0 (120) + ASC submit

| | |
|--|--|
| Version | **1.3.0 (120)** — make-v35 final pre-Apple |
| Branch | `cursor/make-v35-c30d` @ `6a6f331` |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/fbf0926f-6f4a-4d9e-89ba-7947b2c8b653 — **FINISHED** |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/be781424-0253-4c11-be62-18336ff2ceef — **submitted to ASC** |
| IPA | https://expo.dev/artifacts/eas/fOTNkr0Sxr2n05amVQ81FEIvXId1VTpEfDUTIKxPZgo.ipa |
| ASC | https://appstoreconnect.apple.com/apps/6796850110/testflight/ios |
| Prior (119) | make-v34 fold — https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/76664dbd-3577-4092-b3b2-40b135e62fea |
