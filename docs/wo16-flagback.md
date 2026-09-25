# WO16 flag-back — `cursor/audit-merge-c30d`

## §0 harness

Drove `hearAndDrive` / `resolveBaseUtterance` / `mapUiActionsToPlaylist` with a stub
commit handler (now `lib/poppins/iui-tiers.test.ts`).

## Diffs vs the work order (tip was `54004de`, not `aed7078`)

| Item | WO expected | What we saw | Action |
|---|---|---|---|
| **§3.4** task-batch `itemId`/`label` | Missing on task batch | Already landed in `54004de` (`iui-commit.ts` grocery+task) | No code change; covered by test 10 |
| **§3.9** leave-by `~25 min` / bare `"4"` | Fabricated drive / AM invent | Already fixed in `54004de` (`event-leave-by.ts`: bare→`null`, no drive copy) | No code change |

Everything else in §1–§5 reproduced as written and was fixed on this tip.

## §8 — which §2.5 local capability to add now

**Add now: `advance_itinerary` (“next stop”) and `list_overdue` / list peek (“what's overdue” / “what's on my list”).**

Those are the two a parent says in the car and in the kitchen; both are wired into
`ui-intent.ts` on this branch. Leave `claim_reward`, `update_task`, `member_pick`, and
voice-approve of queued confirms to the model for this build.
