# Figma Make design registry

This folder is the **saved mirror** of the Orbit Figma Make source
(`fileKey=4J6d4LW335tDyEDpqq3VD1`).

## Layout

- `SYNC_STATE.json` — last sync metadata (hash, commit, timestamp)
- `source/` — Make source files pulled via Figma MCP
  (`file://figma/make/source/4J6d4LW335tDyEDpqq3VD1/...`)
- `CHANGELOG.md` — human-readable sync notes per PR

## Rules

1. Agents refresh Make source before porting UI.
2. UI lands in `app/` and `components/orbit/` using `constants/orbit-theme.ts`.
3. New entities/fields must extend `supabase/` schema + repositories + store.
4. Do not leave new screens hard-coded against mock data when
   `EXPO_PUBLIC_DATA_MODE=supabase`.

See `docs/figma-sync-automation.md` for the Cursor Automation prompt.
