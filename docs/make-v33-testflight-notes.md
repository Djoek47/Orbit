# make-v33 TestFlight — release notes & tester brief

**Branch tip:** `cursor/make-v33`  
**Data:** staging Supabase (`dejrbyufotcvcillnneo`) — live household data, not mock.  
**Status:** Voice-preview GPT clips baked; avatar bucket on staging; internal TestFlight cut authorized.

---

## What’s in this build (last ~36h)

- Credits / Privacy legal open timing
- Premium Alerts prefs + Activity person showcase
- Fifth-tab multipass (Poppins for admin, Switch on shared tablet only)
- Activity streak chips use Playground photos
- Playground avatars upload to Supabase Storage (durable https)
- Household Health glass popovers + streak unify (personal streak = Today’s Tasks)
- Voice colour-wheel preview + hub warm-up
- Maps logos, shared-tablet 6-person cap copy, error → Support feedback
- Itinerary GPS live banner (distance → grocery list → next stop)
- Plan tab hidden for Sidekick / shared-tablet faces

---

## Release notes (App Store Connect / TestFlight)

This build is our make-v33 TestFlight cut on live staging data. Streaks on Household Health now match Today’s Tasks for whoever is signed in or switched on the tablet. Settings Alerts, Credits, Privacy, Activity photos, and the fifth tab (Poppins vs Switch) are tightened for admin, Sidekick, and shared devices. Poppins voice colour picks can play a short offline sample once GPT clips are baked. Plan trips show a live distance banner and can open the grocery list when you arrive. Maps picker logos and error → Send feedback are included. Please exercise admin, Sidekick, and shared-tablet Switch before we ship to Apple tomorrow.

---

## Tester prompt (paste to testers)

Hi — please install the latest Choremaxx TestFlight (make-v33) and run on **staging / live household data** (not Expo Go mock).

Focus for ~20 minutes:

1. **Admin phone** — Home Today’s Tasks streak vs Household Health streak (same number). Tap Health chips (open tasks / groceries). Settings → Alerts prefs. Credits pack (if testing IAP) and Privacy & legal. Poppins tab present; pick a voice colour and listen for the short preview.
2. **Sidekick** — No Plan tab; complete a task / proof if available; confirm you cannot assign. Sign-out lands on Get Started.
3. **Shared tablet** — Switch faces (Emma/Jack etc.); Switch in the fifth slot; streaks and accents follow the face; max 6 people messaging if you hit the cap.
4. **Plan / trip** — Start a multi-stop trip; confirm distance banner; at a grocery stop open the list; advance stop.
5. **Maps** — Places / trip open: AutoNav / Apple Plans / Google / Waze logos look correct.
6. **Error path** — If something fails, use Send feedback → Support with the error attached.

Reply with: device + iOS version, role tested (admin / Sidekick / tablet face), pass/fail per item, and any screenshots of bugs. Thank you — we’re aiming App Store tomorrow.

---

## Blockers / follow-ups (not stopping this cut)

Product authorized TestFlight push. Remaining dashboard / ASC follow-ups:

- [ ] **Supabase Auth — Leaked password protection (HaveIBeenPwned)** — flip later on staging  
  Dashboard → `dejrbyufotcvcillnneo` → Authentication → Password → Leaked password protection.
- [ ] **Credits ↔ Apple StoreKit end-to-end** — confirm ASC consumable packs live so sandbox buys add credits + receipt email (`docs/asc-iap-setup.md`). Client paths hardened in this cut.

## Cut checklist

1. ~~OpenAI bake~~ — 10 clips in `assets/voice-previews/*.m4a`
2. ~~Staging avatars~~ — `member-avatars` bucket present
3. ~~Prior internal TF~~ — **1.3.0 (116)**
4. ~~Premium UI multipass~~ — Activity Best/You hero, legal frost sheet, Credits success card, transfer accept error card
5. ~~Credits / streak / invite security harden~~ — on tip before this cut
6. [x] **Product said push TestFlight**

| | |
|--|--|
| Version | **1.3.0 (118)** — shared-device rework |
| Branch | `cursor/shared-device-rework-c30d` @ `ffe8c06` |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/4086249a-717b-4b32-9d81-99b5a42f5311 — **FINISHED** |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/2f36d34c-43b8-4fd1-819b-f3313f087c80 — **submitted to ASC** |
| Prior (117) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/ea48c92c-6156-4918-a329-b9d172f2f614 |
| ASC | https://appstoreconnect.apple.com/apps/6796850110/testflight/ios |

**118 extras:** shared-tablet join ≠ Sidekick; atomic Switch + Mark complete; personal vs shared presence; Accept on fresh tablet; picker same-face bind. Edge: `sidekick-sync` + `redeem-profile-invite` redeployed.

## External tester prompt (short — paste as-is)

Install the latest **Choremaxx** build in TestFlight (1.3.0). Sign in with the staging account we sent you. Spend 10 minutes: finish a chore, open Household Health (streak should match Today), try Settings → Poppins voice colour (you should hear a short line), and if you have a shared tablet Switch between faces. Reply with anything broken + a screenshot.
