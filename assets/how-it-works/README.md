# How it works — recorded voices

The demo on **Poppins → How it works** reads its lines aloud. By default it uses the iPhone's
own speech, which is free and offline but sounds robotic.

Drop real recordings here and the player uses them instead, with no code change.

## What to add

One file per beat, named after the beat's id in `lib/poppins/how-it-works-script.ts`:

```
assets/how-it-works/chore-1.m4a
assets/how-it-works/chore-2.m4a
…
```

Then list them in `lib/poppins/how-it-works-audio.ts` — the file says exactly where. Metro only
bundles assets that something `require`s, so the list is the wiring.

## Making them

Any good text-to-speech will do (ElevenLabs, OpenAI `tts-1-hd`, Play.ht). Two voices:

- **Rose** — asking, warmer and a little higher.
- **Indigo** — doing, calmer and a little lower.

The lines are the `line` field of each beat in `how-it-works-script.ts`. Keep the ids identical.
m4a (AAC) or mp3, mono, 44.1 kHz. Aim under 150 KB a line so the app stays small.

Nothing here is required: with no files, the demo falls back to the phone's own voice.
