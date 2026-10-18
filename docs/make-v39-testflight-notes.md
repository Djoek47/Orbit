# make-v39 TestFlight — release notes (build 127)

**Branch tip:** `cursor/make-v39-c30d`  
**Base:** make-v38 / TF **1.3.0 (126)**  
**Status:** **1.3.0 (128)** finished (+ ASC submit). **127** burned (Associated Domains).

### Queued for next TestFlight (not in 128)
- Subscribe / paywall **Account** button: sit in the top bar flow (not absolute under the status bar); 44pt tall — tappable below clock/signal/battery

**Design ref:** Poppins voice edit / understand / listen / chat-follow-card (patches 0001–0004 on v38 tip)  
**Console zip:** still deferred (routing SQL on tip; zip not in this cut)

---

## What's in this build (on top of 126)

### Poppins (primary)
- Voice **edit / move / reassign / delete** of existing tasks — plain-English change cards; waits for the whole sentence
- **Understanding** pass: clean titles, errands vs groceries, fragments, repeats, duplicates
- **Listening** UX: show it's understanding, no repeated YOU bubble, mic recovers itself
- Chat **follows the card**: “Adding Bread…” becomes “Added Bread.” (or says why it didn’t save)

### Credits / errors
- Purchase failures use an in-page soft `PaywallMessage` (tap → Support) + `recordAppError` — never nested orbitAlert / native Alert under Settings
- Soft card renders **outside** the congratulations block so failed buys are visible

### iOS ship fix
- Dropped `ios.associatedDomains` again so non-interactive EAS can archive (App Store profile still lacks Associated Domains). Auth / invites keep `choremaxx://`; Universal Links need an interactive profile refresh later (same as Aug unblock).

### Also folded since 126
- Notifications: “Smart delivery” → **Bundle new tasks** with plain explanation
- Support console: route feedback / emails / errors; users view
- Final pass: no “free” wording without intro offer; purchase disclosure; demo places by id/seed only
- Trips: saved list, orb level, map-first planner (shortest / round-trip)
- Savings badge edge-lit sweep; email confirmation continues; trial eligibility fallback
- Places strip / diagnostics / support emails; actions → **tokens** copy; safe-area content clear
- Sibling Oct tips (whisper, SKU probe, brief pillars, shared-device, how-it-works vocab, grocery tour, face-to-profile, support-feedback, admin calendar, replay menu, assign-request-proof) — all ancestors of tip

---

## Matrix pass

| Check | Result |
|-------|--------|
| Fold audit (sibling `cursor/*-c30d` tips since TF 126) | All FOLDED into tip |
| `HALLOWEEN_RELEASED === false` | OK |
| `tsc --noEmit` | OK |
| Credits buy multipass + error-feedback-loop (soft-card Pass C) | PASS (16) |
| Billing / notif / holidays / seasonal / support multipass | PASS (58) |
| Poppins `lib/poppins/*.test.ts` + voice + craft/voices | PASS (85) |
| All `*multipass*` + plain-language + shared-device-one-flow | PASS (46) |
| `npm run test:logic` | PASS |
| `npx expo lint` | 0 errors (pre-existing warnings only) |
| testflight:preflight | PASS (HaveIBeenPwned warn unchanged) |

---

## Cut

| | |
|--|--|
| Version | **1.3.0 (128)** (127 burned — Associated Domains profile mismatch) |
| Branch | `cursor/make-v39-c30d` |
| PR | https://github.com/Djoek47/Orbit/pull/127 |
| Build 127 | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/90c99cc9-b31b-4a68-bb73-a168b70796bb — **ERRORED** |
| Build 128 | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/c6897bbd-d436-4697-87e6-e506760e54ab — **finished** |
| Submit | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/14dd395d-e749-4382-8cbb-34f0cb30cac1 — **finished** |
| Prior (126) | https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/75c6c07a-304f-43d7-89c9-533244c83439 |
