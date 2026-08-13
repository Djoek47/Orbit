# Poppins rework (IUI is the product)

Not this TestFlight pass. Do not start until MYTIKAS says go. IUI is the key: spoken intent + a constrained scene graph in **one Activity viewport**, not a chatbot around the orb.

Beats: **SHOW → NARROW → UNFOLD → HOLD → SETTLE → CHAIN**. Silence is assent. Compound clauses become a playlist of scenes — they should not fall back into a transcript.

## To do

1. **Memory / continuity** — Poppins must not start brand new every Speak session. Persist household + conversation memory across hangup, app background, and the next tap of Speak (who we are, what we just assigned, open HOLD, last beats). WebRTC `end()` currently wipes the realtime session.
2. **Stage as the primary surface** — IUI Activity is what you look at while you speak. Captions become a thin live line, or go away. Stop treating YOU/POPPINS chat as the product.
3. **Beats / HOLD / barge-in** — make the grammar reliable on TestFlight voice. Barge-in rewinds a beat, not the whole act.
4. **Strip mixed leftover** — chat-style stacked transcripts, duplicate rails, hourglass-as-log, Assign/Create forms competing with HOLD-commit.
5. **Settings / billing / account** — Coach-navigate only; never HOLD-commit.

## Where it lives today

- Method: `docs/iui-method-note.md`
- Scenes / playlist / bus: `lib/poppins/ui-scenes.ts`, `ui-tool-map.ts`, `ui-orchestrator.ts`
- Stage: `components/orbit/poppins-stage.tsx`
- Voice session (no memory yet): `lib/voice/poppins-voice-session.ts`
