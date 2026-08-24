# IUI UX architecture (how Poppins thinks)

Beats and HOLD grammar stay as specified in [`iui-method-note.md`](./iui-method-note.md). This note is product behavior only — not visual restyle.

## Primary goal

Speak what the household should do. See the act. Silence commits. Speech steers. Hangup pauses; it does not undo.

## Product hierarchy

1. **Stage** — the Activity viewport. This is the product while an act is live.
2. **Speak** — one control to start/stop the listening session.
3. **Thin live line** — what was just heard, only when the stage is not already showing it.
4. **Keyboard** — accessibility and Expo Go. Not the default on a voice build.
5. **Activity / notifications** — history. Never mixed with a live HOLD.

Settings, billing, and account are not household acts. They coach-navigate. They never HOLD-commit.

## Primary journey

1. Tap Speak.
2. If we were just here, do not greet. Continue.
3. Spoken intent lands as a scene on the stage (not a chat bubble).
4. Unused beats skip. Compound clauses chain.
5. Quiet → HOLD. Silence is assent. “Wait” freezes. “No” vetoes. A name or day rewinds that beat.
6. Settle, then the next scene or rest.
7. Hangup or background: freeze an open HOLD and remember it. Next Speak restores the same act.

## Interaction rules

| Input | Live HOLD | Idle |
|---|---|---|
| Tap Speak | Stop listening; keep the stage if an act is open | Start / continue session |
| Tap Done (same control) | Same as hangup — pause, do not veto | n/a |
| Silence | Commit | Stay listening |
| “Wait” | Freeze | — |
| “No” / close as cancel | Veto | — |
| Swipe away Activity log | Freeze if live (log is not undo) | Close log |
| Keyboard | Injects into the same session | Accessibility fallback |
| Settings / billing / account | Coach to the human screen | Same |

## What the system remembers (4 hours)

Who we last assigned, what the act was, the last few turns, and any open playlist. WebRTC still tears down; the household conversation does not.

## States the stage must have

First use (brief greet + listen) · returning Speak (no greet) · empty (tap to speak) · live SHOW/UNFOLD/HOLD · frozen · settled · vetoed · hung up with open act · offline / mic denied (type instead, do not block the tab).

## What we will not do

- Restyle the orb, glass, or type.
- Turn the tab back into a chatbot.
- HOLD-commit Settings.
- Ask “are you sure?” on reversible household writes — HOLD is the confirmation.
