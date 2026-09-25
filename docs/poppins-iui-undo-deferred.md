# Poppins IUI undo

Silence-assent HOLD commits immediately. Shipped locally:

- After a successful settle, `undoUntil` / `undoLedger` stay tappable for ~5s.
- **Undo all** — `poppinsUiOrchestrator.undoLast()` reverses every ledger entry (newest first), including multi-write `batch` children via `reverseIuiCommit`.
- **Per-row undo** — `poppinsUiOrchestrator.undoOne(rowId)` reverses one ledger entry or one batch child and leaves the rest; stage ledger rows wire `onUndoOne` on `IuiResultMark`.
- Effect outbox discards deferred notifies for reversed beat/entity ids so they never leave the device.

## Reverse coverage (local)

| Write | Reverse |
| --- | --- |
| `create_task` / `create_homework` | delete task |
| `create_event` | delete event |
| `add_grocery` | remove grocery item |
| `complete_task` / `update_task` | restore task snapshot |
| `create_itinerary_stop` | delete itinerary (best-effort) |
| `advance_itinerary` | rewind stop |
| `upsert_place` | remove saved place |
| `grant_allowance` | reject allowance |
| `clear_grocery` | **no-op** this pass (list not restored) |
| `claim_reward` | **no-op** this pass (meter still reverses via ActEvent) |

## Still deferred

- Cross-device undo (needs a sync channel)
- Undo after the 5s window
