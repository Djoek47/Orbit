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

Orbit must live as its **own** Git repo (this folder) with a pushed GitHub/GitLab
`origin`. Cursor Mobile cannot open a raw Windows Downloads path.

To continue on the go:

1. Push this repo to GitHub and connect it at https://cursor.com/dashboard/integrations
2. Use the Cursor iOS app (or https://cursor.com/agents on Android) on a Pro+ plan with Cloud Agents
3. Or keep the PC awake and use Remote Control / My Machines against this Git-backed workspace
