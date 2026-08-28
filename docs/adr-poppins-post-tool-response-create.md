# ADR: Poppins post-tool `response.create` is mandatory

## Status

Accepted (Divine Voice / Realtime 2.1)

## Context

OpenAI Realtime function calling does **not** automatically continue speaking after the client returns `function_call_output`. If the app only sends the tool output and waits, the model stays silent in “Thinking” and the user hears nothing — the classic Divine Voice footgun.

## Decision

After every tool round on the live voice path (`lib/voice/poppins-voice-session.ts` and the Expo Go WS fallback in `lib/voice/poppins-realtime.ts`):

1. Send `conversation.item.create` with `type: 'function_call_output'` (and a valid `call_id` when present).
2. **Always** send `{ type: 'response.create' }` (optionally `response.instructions`). Never send `response.modalities` — GA Realtime (`gpt-realtime-2.1`) rejects it. Session audio is configured at SDP time.
3. If `call_id` is missing, inject a text context item, then still `response.create`.
4. If the assistant stays silent ~14s after tools, inject a recovery `response.create`.

Server SDP for duplex stays on edge (`poppins-realtime-sdp` → `POST /v1/realtime/calls` with `sk-`). The app never embeds the long-lived API key.

## Consequences

- Spoken summaries after “Add milk” / task creates work reliably.
- Extra `response.create` calls are cheap vs dead-air Realtime sessions; idle hangup still ends the PC when the user walks away.
