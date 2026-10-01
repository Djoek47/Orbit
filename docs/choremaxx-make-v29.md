# ChoreMaxx make-v29

**Branch:** `cursor/make-v29`  
**Follows TestFlight:** **1.3.0 (105)** (make-v28 shopping Live Activity compile fix)

## Included since build 105

| Area | What landed |
| --- | --- |
| Smart Trips | CTA polish, stop timeline animation |
| Settings | Duplicate YOU row removed |
| Shared devices | Remove actually deletes; existing QR view + regenerate |
| People / Sidekicks | Member hub (QR first), presence, rename/picture/remove; personalize no longer locks app |
| Sidekick permissions | Sticky grocery toggle; per-kid face chips; edge redeploy |
| Plan Build trip | Calendar + saved Places only — no FreshMart / fake streets; star card |
| Lock Screen shopping | Compact Live Activity: ChoreMaxx brand, 2 rows/page, page dots, check-off kept |

## Lock Screen note

Apple forbids scrolling inside Live Activities. Tall 3-row layouts clipped the logo. v29 shows **2 items + chevron/dot pager** and a visible **ChoreMaxx** wordmark. Tap a row to check off (App Group → app); Open / header deep-links into the run.

## TestFlight

Non-interactive EAS uses `EXPO_NO_CAPABILITY_SYNC=1`. Full Lock Screen check-off sync still needs App Groups on the main App ID when the provisioning profile is refreshed.
