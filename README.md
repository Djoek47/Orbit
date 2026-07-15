# Orbit

Orbit is the AI Operating System for modern households — tasks, groceries, calendar, rankings, Momentum, and Nova.

## Current development target: Expo Go

Use **Expo Go + mock data** for day-to-day UI and Figma Make sync. Do not require EAS builds or a live Supabase project unless you are intentionally testing those paths.

```bash
npm install
cp .env.example .env   # keeps EXPO_PUBLIC_DATA_MODE=mock
npm start
```

Then open the project in **Expo Go** on your phone. Mock sign-in accepts any email/password and loads the demo household.

## Supabase mode (later)

1. Create a Supabase project.
2. Apply [`supabase/schema.sql`](supabase/schema.sql) (or migrations under `supabase/migrations/`).
3. Deploy edge functions in `supabase/functions/` and set `OPENAI_API_KEY`.
4. Set `EXPO_PUBLIC_DATA_MODE=supabase` plus URL/anon key in `.env`.

## Figma Make sync

Design source: [Design Orbit AI App](https://www.figma.com/make/4J6d4LW335tDyEDpqq3VD1/Design-Orbit-AI-App).

- Registry: `design/make/`
- Automation prompt: [`docs/figma-sync-automation.md`](docs/figma-sync-automation.md)
- Rule: [`.cursor/rules/figma-make-sync.mdc`](.cursor/rules/figma-make-sync.mdc)

Say **“sync from Figma”** (or run a Cursor Automation) to snapshot Make → port UI → wire backend → open a PR. Verify in Expo Go.

## App Store (deferred)

EAS/`eas.json` and legal drafts are scaffolded for when you leave Expo Go. Until then, ignore build/submit scripts.

See [`docs/app-store-checklist.md`](docs/app-store-checklist.md) when ready.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Expo Go |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run figma:check` | Validate design registry |
| `npm run build:ios` | EAS iOS production build |
| `npm run submit:ios` | EAS Submit to App Store Connect |

## Product docs

- [`docs/product-context.md`](docs/product-context.md)
- [`docs/ux-design-system.md`](docs/ux-design-system.md)
- [`docs/technical-blueprint.md`](docs/technical-blueprint.md)
