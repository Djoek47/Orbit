# IUI method note (not a filing)

Short stub so later work does not paint over the method. Tone matches the other paper-style briefs. Not legal advice. Not a priority this pass.

## Problem

Household software still asks people to drive forms: tap Create Task, fill fields, confirm. Voice assistants either dump a transcript or remote-control the whole app like a desktop. Neither is a language. Silence — the cheapest yes — is wasted.

## Method

Choremaxx IUI is a **dual-channel household OS**:

1. **Spoken intent** names the act (who, what, when).
2. A **constrained scene graph** in a **single viewport** (the Activity stage) shows the referents as designed primitives (Face, Chip, GhostField, Lattice, Day, Stop, Road, ObjectCard, HoldRing, Peek, Coach). Luna / Realtime pick letters from a closed enum. They do not generate React Native.

Beats are the grammar: SHOW → NARROW → UNFOLD → HOLD → SETTLE → CHAIN. Unused beats skip when the utterance already named them. Compound clauses become a **playlist** of scenes without returning to a chat transcript.

The architecture name is **AIUIC** (Artificial Intelligence Interface Control), also called IUI / EUI: a universal UI that Poppins controls. The overlay is not a chatbot caption — it is the Assign grid, grocery card, and done check, brought up and taken away by the model.

**Silence is assent.** A visible temporal HOLD (~0.85s, longer for kids) sits on a previewed mutation. Saying nothing commits. Speech steers. “Wait” freezes. “I’ll do it” coaches into a human editor. Spoken words paint on the stage as they arrive — the loop is a genie, not a loading bar.

**Barge-in rewinds a beat** (assignee, day) rather than discarding the whole act. Settings, billing, account, and reward-model never HOLD-commit; they Coach-navigate only.

## Claims in plain language

1. Dual-channel household OS: spoken intent synchronized to a constrained UI scene graph in a single viewport.
2. Silence as assent via a visible temporal HOLD on a previewed mutation.
3. Compound-intent playlist of scenes without returning to a chat transcript.
4. Voice barge-in that rewinds a beat rather than discarding the whole act.
5. Hands-free mutation with visual preview and spoken veto; Settings excluded from HOLD-commit.

## Where it lives

- Scenes: `lib/poppins/ui-scenes.ts`
- Playlist map: `lib/poppins/ui-tool-map.ts`
- Bus / HOLD / barge-in: `lib/poppins/ui-orchestrator.ts`
- Stage: `components/orbit/poppins-stage.tsx`

## Rework list

See [`poppins-rework.md`](./poppins-rework.md). Highest new item: **memory so Speak does not start brand new every time**.
