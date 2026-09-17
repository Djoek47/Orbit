# AIUIC spec v0.1

Method claims live in `iui-method-note.md`. Product behavior in
`iui-ux-architecture.md`. This file records assent channels only.

## §1 — One stage

Poppins owns a single overlay. Beats are the grammar. HOLD is silence-as-assent on a previewed mutation.

## §2 — Speak continuity

Hangup freezes; it does not undo. `IuiContinuity` restores an open act as a frozen preview.

## §3 — Dual channel

Talking and touching are the same IUI. Whoever is faster owns the next beat.

## §4 — Notification assent (first-class channel)

A proposed act may render as an OS notification with **Approve** / **Change**.

| Channel | Assent | Proves perception? | Latency matters? |
|---|---|---|---|
| Silence (visual stage) | no input for ~850ms | no — only that the screen was up | yes |
| Spoken / Live | speech or silence | no | yes |
| **Notification** | **explicit tap** | **yes** | **no** |

Rules:

1. Approve runs the **same** `commitIuiBeat` path the stage uses — one commit path, not two.
2. Change deep-links to the Poppins tab and restores the beat as a frozen preview via `IuiContinuity`.
3. Blast-radius: only reversible, recipient-scoped acts may Approve from the notification. Acts that touch another person or money open the app (Change).
4. Expiry: unanswered acts expire; absence is never assent.
5. Cost: a notification-delivered act charges **1 token** (Silent weight). No Realtime session required.

Implementation:

- Category: `lib/notifications/iui-act-category.ts` (`choremaxx.iui_act`)
- Serialize: `lib/poppins/iui-act-notification.ts`
- Response: `lib/notifications/iui-act-response.ts`
- Push: `supabase/functions/dispatch-member-push` passes `categoryId` for `kind: iui_act`
