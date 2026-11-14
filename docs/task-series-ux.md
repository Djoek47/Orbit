# Task series — how chores think after assignment

Product behavior only. Beats, visuals, and IUI are unchanged.

## Primary goal

Change a repeating chore the way people think about it: **Maya does dishes every day** — until she does not, or until it is weekdays, or until someone else does it.

Assignment is not a one-way form. The household rule stays editable.

## Product hierarchy

1. **The chore** — one series (who, what, how often). This is the object.
2. **Today** — one occurrence of that series.
3. **History** — completed and expired days. Frozen. Not a second editor.

Do not add a Series tab, a Recurrence settings page, or a wizard. Open the task.

## Mental model

| Person thinks | System does |
|---|---|
| “Make this weekdays” | Change the rule **from this day on**. Past days stay as they were. |
| “Not today” | Skip this occurrence. The rule continues tomorrow. |
| “We don’t do this anymore” | Stop repeating. Keep today unless they also skip. |
| “Give this to Alex” | From this day on. Completed days still show the old name. |

Frequency is **not** a library constant. Changing it does not edit the task library.

## Who can

Admins / adults who can assign. Sidekick and child complete; they do not rewrite the household rule.

## Interaction rules

| Input | Open repeating chore | One-off |
|---|---|---|
| Tap Repeat | Inline Daily / Weekly / Weekdays / Doesn’t repeat. Saves immediately, from now on. | Same — picking a repeat **starts** a series |
| Tap Doesn’t repeat on a series | Confirm: stop future. Today stays unless they skip. | n/a |
| Tap Who | Same chips as assign. From now on. | This occurrence |
| Pencil | Title, notes, XP, category — this occurrence unless title changes on a series (from now on) | This occurrence |
| Skip today | Cancel this day. Series continues. No “are you sure?” | Cancel this task |
| Stop repeating | Confirm. Today stays; nothing new is generated. | Hidden |
| Delete | Erase this row. Rare. Confirm. | Confirm |

Silence: if they open the task and leave, nothing changes.

Do not ask this vs future on every frequency tap. **From now on** is the default. Calendar-style “only this day” is Skip, not a frequency exception editor.

## What the system remembers

A stable `definitionId` for the series. Repeat, assignee, and title are fields on the rule — they must not be baked into the id.

Any from-now-on edit stamps that id on **every** occurrence, including frozen history, so renaming cannot split the series.

Spawn (midnight / foreground) uses the **latest non-skip rule**. Skip-today is ignored. Doesn’t repeat on the newest remaining day stops generation.

## States

- First assign: library default frequency, editable immediately.
- After assign: Repeat and Who are tappable, not read-only captions.
- Skip today: Cancelled record; Today list hides it; tomorrow still appears.
- Skip on the only generated day: series still continues tomorrow. Cancelled + still repeating is a skip, not a stop.
- Stopped: today can remain Pending with no repeat; tomorrow does not appear.
- Stop from a completed day: later open days cancel; older Daily completions do not start spawning again.
- Completed / expired: Repeat still tappable so they can change the rule from that day forward. History before that day does not rewrite.
- Offline: optimistic write, same as other task edits. On failure, keep the preview and say it could not save — tap to try again.
- Permission denied: Repeat is text, not a control. No dead button.

## Confirmation

- Frequency Daily → Weekdays: no confirm.
- Skip today: no confirm (reversible by assigning again for today).
- Stop repeating: confirm (consequential for tomorrow).
- Delete: confirm (destructive).

## What we will not do

- A separate Recurrence screen.
- Encoding frequency into the series id.
- Asking “this event / future events” on every chip.
- Letting Sidekick rewrite the household rule.
- HOLD-commit Settings.
