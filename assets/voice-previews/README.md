# Voice previews (Settings → How Poppins sounds)

Short offline clips — one line per colour-voice — so changing Rose → Amber can play
**“Ready when you are.”** without spending credits at runtime.

## Bake

```bash
OPENAI_API_KEY=sk-... node scripts/generate-voice-previews.mjs
```

Writes `assets/voice-previews/<voice-id>.m4a` and wires `lib/ai/voice-preview-audio.ts`.

Until clips are committed, the wheel uses a free device-Speech fallback with pitch that
follows the wheel (higher at Rose, lower at Indigo) so the UX still works in Expo Go.
