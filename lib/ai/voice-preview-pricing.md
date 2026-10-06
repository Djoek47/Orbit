# Voice preview cost (Settings → How Poppins sounds)

## What ships now (default)

**Device Speech** with pitch that follows the colour wheel.  
**$0** runtime · **$0** bake · works in Expo Go. Good for testing the UX.

## Optional upgrade: baked GPT clips (one-time)

Same sentence for every household (`Ready when you are.` / `Hi {name}…` on device only):

| | |
| --- | --- |
| Model | `gpt-4o-mini-tts` |
| Voices | 10 colour stops × ~2 s each ≈ **20 s** total |
| OpenAI list price | ~**$0.015 / minute** → about **$0.005** for the whole bake |
| After bake | Clips live in `assets/voice-previews/*.m4a` — **no credits, no API** at preview time |

Bake once:

```bash
OPENAI_API_KEY=sk-… node scripts/generate-voice-previews.mjs
```

Then commit the m4a files + wired `lib/ai/voice-preview-audio.ts`. Every install plays the same offline samples.

**Not** charged per user and **not** deducted from Poppins actions/credits.
