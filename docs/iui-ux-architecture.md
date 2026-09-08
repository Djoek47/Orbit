# IUI UX architecture (how Poppins thinks)

Beats and HOLD grammar stay as specified in [`iui-method-note.md`](./iui-method-note.md). This note is product behavior only — not visual restyle.

One mind, three memory layers, and Speak opening policy live in [`household-intelligence.md`](./household-intelligence.md). Do not invent a second brain named Nova.

## Two modes (one stage)

Talking and touching are the same IUI. Whoever is faster owns the next beat.

| Mode | What happens |
|---|---|
| **Talking** (hands off) | Poppins paints the stage and only shows **what is still unknown**. “Set up a task for today” → faces. “It’s for me” → you are chosen; next unknown beat. “Kitchen tomorrow” → Kitchen + kitchen tasks + Tomorrow — never the 14-category grid once category is known. |
| **Touching** | A finger press is a decision **now**, including while Poppins is still speaking. Speech is cancelled; the choice is injected (“On the IUI I chose …”). Press assign → write immediately. Auto-HOLD still waits until speech is done. |

Activity (hourglass) is a log for notifications. It never opens itself. Open it only from the hourglass, or by asking Poppins to open Activity / Settings.

## Primary goal

Speak what the household should do. See the act. Silence commits. Speech steers. Hangup pauses; it does not undo.

## Product hierarchy

1. **Stage** — the IUI on the Poppins tab. This is the product while an act is live.
2. **Speak** — one control (thumb) to start/stop listening. The orb is status, not a second button.
3. **Thin live line** — what was just heard, only when the stage is not already showing it.
4. **Keyboard** — accessibility and Expo Go. Not the default on a voice build. Opens itself if the mic or network fails.
5. **Activity / notifications** — history, from the hourglass. Never mixed with a live HOLD.

Settings, billing, and account are not household acts. They coach-navigate. They never HOLD-commit.

## Primary journey

1. Tap Speak.
2. If we were just here, do not greet. Continue.
3. Spoken intent lands as a scene on the stage (not a chat bubble).
4. Unused beats skip. Compound clauses chain.
5. Quiet → HOLD. Silence is assent. “Wait” freezes. “No” vetoes. A name or day rewinds that beat.
6. Settle, then the next scene or rest.
7. Hangup or background: freeze an open HOLD and remember it. Returning to the tab shows that preview. HOLD does not run again until Speak is listening.

## Interaction rules

One **Speak**. The orb is status, not a second button. Activity is the hourglass — not a second chevron.

| Input | Live HOLD | Idle |
|---|---|---|
| Tap Speak | Stop listening; keep the stage if an act is open | Start / continue session |
| Tap Done (same control) | Same as hangup — pause, do not veto | n/a |
| Silence | Commit — only while actually listening | Stay listening |
| “Wait” | Freeze | — |
| “No” / close as cancel | Veto | — |
| Tap frozen preview | Confirm (fast path after hangup) | — |
| Tap a face / chip / category | Decision now; cancel speech; do not re-offer that choice | Same |
| Open / close Activity | History only (hourglass). Never auto-opens | Close log |
| Keyboard | Injects into the same session | Side door; auto-opens if mic/network fails |
| Settings / billing / account | Coach to the human screen | Same |

## What the system remembers

**Session (4 hours):** who we last assigned, what the act was, the last few turns, and any open playlist. WebRTC still tears down; the household conversation does not.

**House (durable):** likes, dislikes, and routines. Spoken, not a form. See [`household-intelligence.md`](./household-intelligence.md).

## States the stage must have

First use (one presence line, never a bio) · returning Speak (listen, no greet) · long gap with desk work (one situation line) · empty (tap to speak) · live SHOW/UNFOLD/HOLD · frozen (act still on screen, clock stopped) · settled · vetoed · hung up with open act · offline / mic denied (type instead, do not block the tab) · commit failed (keep the preview, tap to try again).

## What we will not do

- Restyle the orb, glass, or type.
- Turn the tab back into a chatbot.
- HOLD-commit Settings.
- Ask “are you sure?” on reversible household writes — HOLD is the confirmation.
