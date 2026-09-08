# Poppins rework (IUI is the product)

Canonical remaining list: [`remaining.md`](./remaining.md) §1.

Not visual restyle. MYTIKAS said go on TestFlight 40. Beats/HOLD stay. See [`iui-ux-architecture.md`](./iui-ux-architecture.md) and [`household-intelligence.md`](./household-intelligence.md).

Beats: **SHOW → NARROW → UNFOLD → HOLD → SETTLE → CHAIN**. Silence is assent. Compound clauses become a playlist of scenes — they should not fall back into a transcript.

## Done on this tip

1. **Memory / continuity** — last act + turns persist 4h. Hangup pauses; next Speak restores and does not greet. Durable house facts (likes / dislikes / routines) seed defaults. One mind — majordomo is a face, not a second AI.
2. **Stage as the primary surface** — live IUI is the Poppins tab viewport. Captions idle-only. Keyboard tucked away on native voice.
3. **Hangup is pause** — not veto. Activity log close is pause.
4. **Activity is history** — no longer hosts the live stage.
5. **Settings / billing / account** — coach-navigate only (unchanged grammar).

## Still device-check

Barge-in on TestFlight voice, mic-denied type path, frozen HOLD tap-to-confirm.

## Where it lives today

- Method: `docs/iui-method-note.md`
- Scenes / playlist / bus: `lib/poppins/ui-scenes.ts`, `ui-tool-map.ts`, `ui-orchestrator.ts`
- Stage: `components/orbit/poppins-stage.tsx`
- Voice session (listen-first, house memory hint): `lib/voice/poppins-voice-session.ts`
- Opening policy + Speak glue: `lib/poppins/opening-policy.ts`, `lib/poppins/speak-open.ts`
- House memory: `lib/poppins/house-memory.ts`
