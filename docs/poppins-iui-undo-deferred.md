# Poppins IUI undo (deferred)

Silence-assent HOLD commits immediately. Minimum shipped in orchestrator:

- After a successful settle, `undoUntil` / `undoBeat` stay tappable for ~5s via `poppinsUiOrchestrator.undoLast()`.
- Wire a settle-mark affordance in the stage UI when ready.

**Out of scope for this pass** (full design later):

- Deferred side effects / blast-radius rules for multi-write acts
- Cross-device undo
- Undo after the 5s window
