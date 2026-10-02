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

## TestFlight

| Build | Branch / commit | Notes |
| --- | --- | --- |
| **1.3.0 (107+)** | `cursor/make-v30` | EAS `autoIncrement`; `EXPO_NO_CAPABILITY_SYNC=1` |

Non-interactive EAS uses `EXPO_NO_CAPABILITY_SYNC=1`.
