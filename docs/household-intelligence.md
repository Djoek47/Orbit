# Household intelligence (one mind)

Poppins, the selected majordomo, and the historical name Nova are **one household co-manager**. The face (voice, tone, accent) lives in [`lib/ai/majordomo-profiles.ts`](../lib/ai/majordomo-profiles.ts). There is no second brain and no parallel Nova stack.

IUI is the stage. Speak is the ear. Inbox briefing and Home cards are the same mind on other surfaces. All four share the same memory and the same opening policy.

## Three memory layers

| Layer | Lifetime | What it remembers | Code |
|---|---|---|---|
| **Now** | computed each Speak | overdue by who, groceries, next events | `buildPoppinsDeskBrief` |
| **Session** | 4 hours, AsyncStorage | last act, last turns, frozen HOLD | `IuiContinuity` |
| **House** | durable | likes / dislikes / routines | `lib/poppins/house-memory.ts` |

House facts are spoken, not a settings form: “we always shop at Metro”, “don’t assign dishes to Liam”. Cap ~40. Newest wins on the same subject + kind. Privacy-sensitive facts (medical, passwords, home address) ask for confirm; everyday prefs do not.

## Opening policy

Default is **listen**. Never “Hi, I’m Poppins.”

| Situation | Spoken open | Then |
|---|---|---|
| First ever for this household | One presence line, never a bio | Listen |
| Return within 4h | **Nothing** | Listen |
| Morning / long gap, and desk has work | Situation: “Liam still has dishes. Want a reminder?” | Listen |
| User already speaking during connect | **Cancel opener** | Treat audio as turn 1 |
| IUI act frozen on screen | Nothing | Continue that act |

Policy module: [`lib/poppins/opening-policy.ts`](../lib/poppins/opening-policy.ts). Speak glue: [`lib/poppins/speak-open.ts`](../lib/poppins/speak-open.ts).

## Presence, not a spinner

Real SDP time cannot go to zero. Speak is usable before the model talks:

- Warm the mic on Poppins tab focus **after** permission is already granted. Do not mint a paid Realtime session until Speak.
- On datachannel open: seed turns if any; do **not** `response.create` a greet. Situation / presence is a policy decision.
- If the user is already speaking, skip the opener.
- Status copy: “Tuning in…” → “Listening”. Reuse the orb `thinking` state. No PROCESSING label.

## IUI

Beats, HOLD, and `hearAndDrive` stay as specified in [`iui-ux-architecture.md`](./iui-ux-architecture.md). Memory only seeds defaults (who, store), chooses situation vs silence, and restores a frozen act.
