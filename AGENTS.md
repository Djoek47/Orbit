# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Orbit UI Guidance

Use the Expo `building-native-ui` skill for native UI work in this project.
Prefer Expo Go first for development and only create custom native builds when
the feature requires native code or configuration outside Expo Go.

# Product Source Of Truth

Before implementing product, UI, routing, data model, or Nova behavior, read:

- `docs/product-context.md`
- `docs/ux-design-system.md`
- `docs/technical-blueprint.md`

Orbit is an AI Household Operating System. Keep the app calm, premium,
household-first, realtime-ready, permission-aware, and centered on Nova as a
proactive co-manager rather than a generic chatbot.

# Cursor Mobile / Cloud Agents

Orbit lives at https://github.com/Djoek47/Orbit — Cloud Agents clone that remote.

## Cursor Cloud specific instructions

- Default data mode is mock: `EXPO_PUBLIC_DATA_MODE=mock` (see `.env.example`).
- After clone / on cloud VM: `npm install`, then `npx expo start` only if you need Metro; most UI work can be validated by lint/tsc and reading screens.
- Design source: Figma Make `4J6d4LW335tDyEDpqq3VD1` — sync via Figma MCP when the user asks; do not assume Figma is available in every cloud run.
- Do not commit `.env`, `node_modules/`, or `.npm-cache/`.
- Prefer Expo Go workflows over native `ios/` / `android/` folders unless the task requires a custom build.

To continue on the go:

1. Repo is on GitHub — connect it at https://cursor.com/dashboard/integrations
2. Use Cursor iOS or https://cursor.com/agents on a paid plan with Cloud Agents
3. Or keep the PC awake and use Remote Control / My Machines against this Git-backed workspace
