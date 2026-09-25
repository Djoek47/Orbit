# Poppins Base (Quiet) — contract

Base is the cheap, always-available tier. It must work without WebRTC and
without the chat model for every household **act**.

## Pipeline

```
speech → Whisper (transcript only) → local grammar (clause-segment + ui-intent)
       → IUI card → HOLD → commit → local confirmation line
```

The chat model is called **only** when the grammar did not take the utterance
(a question, chit-chat, something unparsed). Teaching is a question like any
other and still costs **0** actions.

## Consequences

| Case | Actions charged |
| --- | --- |
| Successful Base act (local grammar) | **1** |
| Failed capture (no transcript) | **0** — never record an `ActEvent` |
| Teaching / how-to | **0** |
| Chat model down | Acts still work; only questions degrade |

## Mic

Gate by **transport**, not by WebRTC:

- Base (`speakBack: false`) → needs `expo-audio` only.
- Max (`speakBack: true`) → needs WebRTC; when missing, show a disabled mic
  and offer switch-to-Base.

## Capture

Hold to talk. Release to send. Tap once for a 10-second window with Stop.
Metering drives the waveform only — it never gates whether audio is sent.
