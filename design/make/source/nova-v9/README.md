# Nova v9 Make mirror

Source: https://www.figma.com/make/4J6d4LW335tDyEDpqq3VD1/Design-Orbit-AI-App (v9)

Ported into Expo:
- `app/(tabs)/nova.tsx` — Nova + Nova Activity sheet
- `components/orbit/nova-orb.tsx` — glass orb states
- `components/orbit/nova-waveform.tsx` — waveform bars
- `design/make/source/nova-v9/nova-activity.ts` — Make activity seed shape

Realtime readiness: `lib/voice/nova-realtime.ts` + `EXPO_PUBLIC_NOVA_REALTIME=1`.
