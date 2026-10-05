# ChoreMaxx make-v30

**Branch:** `cursor/make-v30`  
**Cut from:** `cursor/make-v29`  
**Follows TestFlight:** **1.3.0 (106)** (make-v29)

## Included since make-v29

| Area | What landed |
| --- | --- |
| Home today tasks | Expired/Missed excluded; household timezone; preview prefers open + photo-needed |
| Live refresh | Sidekick 3s sync hardened on failure (local expiry); Home focus refresh; admin 5s Home safety-net; expiry tick 10s when active |
| Today card UI | Soft accent wash (House Rules energy); clearer open count; stronger photo-needed row |
| Shared Switch | Fifth-tab Switch from shared-tablet device session (carry-over + regression tests) |
| Select profile | “Who's using this device?”; 2–6 centered faces |
| Settings | Sidekick/shared device labels (no iPad); Sign this device out wipe |
| Removal protocol | Notify → 12s countdown → kick; profile code blocked |
| Grocery Lock Screen | Still off (v29) |
| Proof alert | Title-only **Proof sent** |
| Credits bank | Mock/Expo Go buys grant real pack sizes; new packs **add** to prior balance; local+remote merge so empty remote never wipes banked credits; bought credits never expire (monthly allowance still resets) |
| Notifications | Sidekick hydrate after sign-out/Continue-as no longer rebroadcasts history; live sync announces only real diffs; interrupt dedupe for same task; tray cleared on sign-out |
| Live streaks | House Rules teaser dots track real `member.streak` (0 days = all empty); award gate uses daily/weekday only; Inbox → Activity streak strip (admin household / self + shared peers) |
| Switch UX | Removed deprecated Home/Tasks “Switch account” popup chips; tab-bar **Switch** is the real profile handoff; Tasks **Who's on** is an animated view filter (Jack/Emma… up to 6) without signing out |

## TestFlight

| Build | Branch / commit | Notes |
| --- | --- | --- |
| **1.3.0 (107)** submitted | `cursor/make-v30` @ `7b442a7` | [build](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/builds/2deddfd8-f979-43cb-af1a-40b8edf542b5) finished 2026-10-02 13:37 UTC; [auto-submit](https://expo.dev/accounts/choremaxx-team/projects/choremaxx/submissions/19bf326e-92a1-4da6-89c0-0d793f794666) finished 2026-10-02 14:05 UTC (App Store Connect processing may take a few minutes before TestFlight install) |

Non-interactive EAS uses `EXPO_NO_CAPABILITY_SYNC=1`.
