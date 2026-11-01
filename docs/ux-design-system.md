# Choremaxx UX And Design System Notes

> **Superseded.** The full design system now lives in [`docs/design-system/`](./design-system/01-product-philosophy.md) (11 documents: philosophy, design language/tokens, motion, information hierarchy, component library, screen specifications, Nova experience, Liquid Glass guidelines, UI audit, execution tasks, and reverse-engineered Apple app patterns). This file is kept as a short pointer only — do not add new design guidance here.

> **Brand (Make v7+):** Product name is **Choremaxx**. Code tokens may still use `orbit*` prefixes.

## Where to look

- **Why Choremaxx looks and feels the way it does:** [`design-system/01-product-philosophy.md`](./design-system/01-product-philosophy.md)
- **Colors, typography, spacing, radius, shadows, materials:** [`design-system/02-design-language.md`](./design-system/02-design-language.md)
- **Motion, gestures, haptics, navigation patterns:** [`design-system/03-motion-interaction.md`](./design-system/03-motion-interaction.md)
- **How to structure a screen's content:** [`design-system/04-information-hierarchy.md`](./design-system/04-information-hierarchy.md)
- **Shared components (Button, Card, Task Row, Tab Bar, etc.):** [`design-system/05-component-library.md`](./design-system/05-component-library.md)
- **Per-screen specs (Purpose/Hierarchy/Remove/Simplify/Keep):** [`design-system/06-screen-specifications.md`](./design-system/06-screen-specifications.md)
- **Nova's reframe as an Apple-Intelligence-style surface:** [`design-system/07-nova-experience.md`](./design-system/07-nova-experience.md)
- **When and how to use glass/blur materials:** [`design-system/08-liquid-glass-guidelines.md`](./design-system/08-liquid-glass-guidelines.md)
- **What's wrong today, screen by screen:** [`design-system/09-ui-audit.md`](./design-system/09-ui-audit.md)
- **The numbered implementation checklist:** [`design-system/10-cursor-tasks.md`](./design-system/10-cursor-tasks.md)
- **Apple app patterns to emulate:** [`design-system/11-reverse-engineering-apple-apps.md`](./design-system/11-reverse-engineering-apple-apps.md)

## Still true, still here

Product/navigation facts that other docs depend on and are safe to keep referencing from this file directly:

- **Figma Make v7** (visual source for Expo Go testing) uses five primary tabs: Home, Tasks, Plan (Calendar + Itineraries), Rewards (Rewards + Allowance + Rankings), Nova. Role filters: child hides Plan; roommate hides Rewards. Groceries stay reachable from Home / Settings / deep links but are not a primary tab in v7. Settings/Admin and Create Task are overlays in Make.
- When Make and product docs diverge, sync via the Figma MCP workflow in `.cursor/rules/figma-make-sync.mdc`, then reconcile against `docs/product-context.md`.
- The `docs/design-system/` suite is authoritative for **visual/material/motion/component** detail; `.cursor/rules/figma-make-sync.mdc` and `docs/product-context.md` remain authoritative for **information architecture** (which tabs exist, which roles see what).
