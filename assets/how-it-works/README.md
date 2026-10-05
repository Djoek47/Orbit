# How it works — GPT conversational voices

The demo on **Poppins → How it works** plays a saved conversation: you ask, Poppins answers.
It must **never** use the iPhone’s Speech reader (that sounded French / robotic).

**Shipped:** 18 gpt-4o-mini-tts clips (Rose=`coral`, Poppins=`sage`) are committed here and wired in
`lib/poppins/how-it-works-audio.ts`. Re-bake only when the script lines change.

## Bake the audio (once)

```bash
OPENAI_API_KEY=sk-... node scripts/generate-how-it-works-audio.mjs
```

That calls OpenAI **gpt-4o-mini-tts** with conversational instructions (ChatGPT Advanced Voice
style), writes `assets/how-it-works/<beat-id>.m4a`, and wires `lib/poppins/how-it-works-audio.ts`.

Voices (override with env):

- Rose / You → `coral` (`OPENAI_TTS_ROSE`)
- Indigo / Poppins → `sage` (`OPENAI_TTS_INDIGO`)

Then commit the `.m4a` files + the updated audio module.

## Or drop your own takes

One file per spoken beat id in `lib/poppins/how-it-works-script.ts`, then list them in
`lib/poppins/how-it-works-audio.ts` the same way the generator does. m4a (AAC) mono 44.1 kHz.
