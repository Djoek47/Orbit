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

## Blockers before next TestFlight / App Store push

Do **not** cut another TF or App Store build until these are cleared:

- [ ] **Supabase Auth — Leaked password protection (HaveIBeenPwned)** — **noted; flip later (not blocking today’s code work)**  
  Staging project `dejrbyufotcvcillnneo` → Dashboard → **Authentication** → **Providers** / **Password** → enable **Leaked password protection**.  
  Advisor: `auth_leaked_password_protection`. Not settable from SQL.  
  See `docs/supabase-security-advisors-2026-10-06.md`.
- [ ] **Credits ↔ Apple StoreKit end-to-end** — packs must be live in ASC so real buys add credits + send receipt email (`docs/asc-iap-setup.md`). Client grant/error paths hardened; wire/verify tomorrow before final push.
- [ ] Product explicitly says “push TestFlight”

## Cut checklist

1. ~~OpenAI bake~~ — 10 clips in `assets/voice-previews/*.m4a`
2. ~~Staging avatars~~ — `member-avatars` bucket present
3. ~~Internal TF queued~~ — **1.3.0 (116)** auto-submit
4. [ ] **Leaked password protection ON** (blocker above) — required before any new push

| | |
|--|--|
| Version | **1.3.0 (116)** |
| Branch | `cursor/make-v33` @ `92e2498` |
| Build | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/2c539a10-c16a-41f8-83ae-a274342b7d74 |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/d7ddbafc-149d-45d2-81ee-cc8ec2ce6475 |
| ASC | https://appstoreconnect.apple.com/apps/6796850110/testflight/ios |

## External tester prompt (short — paste as-is)

Install the latest **Choremaxx** build in TestFlight (1.3.0). Sign in with the staging account we sent you. Spend 10 minutes: finish a chore, open Household Health (streak should match Today), try Settings → Poppins voice colour (you should hear a short line), and if you have a shared tablet Switch between faces. Reply with anything broken + a screenshot.
