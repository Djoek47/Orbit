# Orbit UX And Design System Notes

Use these notes with the Expo `building-native-ui` skill and SDK 54 docs.

## Visual Direction

Orbit should feel like Apple Home + Apple Health + Apple Fitness + a premium AI assistant. It should be calm, premium, organized, emotionally supportive, and Apple-quality.

Design references:

- Apple Home: warmth and household feel.
- Apple Health: clear data hierarchy.
- Apple Fitness: progress and positive reinforcement.
- Vision Pro: depth and focus.
- Arc and Linear: modern clarity without enterprise heaviness.

Avoid Trello, Notion, Monday, generic family organizers, childlike chore apps, and busy dashboards.

## Brand

- Product name: Orbit.
- AI co-manager: Nova.
- Brand personality: calm, organized, trustworthy, intelligent, family-friendly.
- Nova personality: thoughtful family co-manager, not chatbot.
- Logo metaphor: home at the center, orbital ring, small satellite node.
- Reference assets:
  - `assets/brand/orbit-logo-mark.png`
  - `assets/brand/orbit-logo-lockup-dark.png`

## Color Tokens

- `orbit.blue.500`: `#2979FF`
- `nova.cyan.500`: `#00C2FF`
- `success.green.500`: `#32D583`
- `warning.amber.500`: `#FFB547`
- `error.red.500`: `#FF5A5F`
- Light background: `#F7F9FC`
- Light card: `#FFFFFF`
- Light primary text: `#101828`
- Light secondary text: `#667085`
- Dark background: `#0B1220`
- Dark card: `#131C2E`
- Dark elevated: `#1D2939`
- Dark primary text: `#FFFFFF`
- Dark secondary text: `#98A2B3`

Use blue/cyan as accents, not as a one-note wash. The palette should reduce stress.

## Type Scale

- Display XL: 40, bold.
- Display L: 32, bold.
- Heading: 24, semibold.
- Card title: 20, semibold.
- Body: 17, regular.
- Caption: 13, regular.

Keep app surfaces native and readable. Prefer navigation titles over custom page hero text inside core app screens.

## Spacing And Shape

- Spacing: 8, 16, 24, 32, 48, 64.
- Radius small: 12.
- Radius medium: 18.
- Radius large: 24.
- Radius hero: 32.
- Cards should be large, rounded, soft, and purposeful. Use continuous curves where supported.

## Motion

Motion communicates state, never decoration.

- Fast: 150ms for buttons.
- Medium: 300ms for cards and state changes.
- Slow: 600ms for Momentum and Nova moments.
- Momentum should glow or brighten when the household is balanced.
- Nova orb states: idle, listening, thinking, speaking.
- Task completion can show positive XP feedback.
- Badge unlocks can have a small reveal.

## Navigation

**Figma Make v4+ (visual source for Expo Go testing)** uses five primary tabs:

- Home
- Tasks
- Grocery
- Ranking / Ranks
- Nova

Calendar stays in the codebase but is hidden from the primary tab bar while Make drives local visual testing. Settings/Admin and Create Task are overlays in Make.

Longer-term product IA in the MVP docs still includes Calendar and a full Rewards shop. When those diverge from Make, sync via the Figma MCP workflow in `.cursor/rules/figma-make-sync.mdc`, then reconcile against this document.

## MVP Screens

Core Figma blueprint screens:

- Splash.
- Welcome.
- Create Household.
- Join Household.
- Home Dashboard.
- Tasks Dashboard.
- Task Details.
- Create Task.
- Grocery Dashboard.
- Add Item.
- Shopping List.
- Calendar.
- Event Details.
- Create Event.
- Rewards Dashboard.
- Reward Shop.
- Badge Gallery.
- Nova Home.
- Nova Conversation.
- Household Members.
- Household Balance.
- Momentum Details.
- Notifications.
- Weekly Report.
- Settings.

Inventory document expands this to 34 primary MVP screens including analytics and permissions.

## Component Inventory

Foundation:

- Primary Button: filled, outlined, text, danger.
- Input Field: single line, multiline, search, secure.
- Card Container: hero, standard, compact, analytics.
- Avatar: XS, S, M, L, XL.
- Status Chip: success, warning, error, info.

Navigation:

- Bottom Navigation.
- Top Navigation Bar.
- Floating Action Button.

Dashboard:

- Momentum Card.
- Nova Briefing Card.
- Task Summary Card.
- Grocery Summary Card.
- Event Summary Card.
- Mental Load Card.

Domain:

- Task Card, Task Progress, Task Proof Upload.
- Grocery Item, Store Recommendation, Inventory Card.
- Event Card, Calendar Grid.
- XP Card, Badge Card, Reward Card.
- Nova Orb, Briefing Card, Recommendation Card.
- Momentum Ring, Load Distribution Chart, Participation Graph.

## Interaction Rules

- One tap for common actions.
- Three taps maximum for advanced actions.
- Grocery missing-item entry should be near-frictionless.
- Nova should suggest drafts and recommendations, not silently make consequential changes.
- Rewards redemptions require parent approval.
- Guest access must be constrained and obvious.
