# 02 — Choremaxx Design Language

> This is Choremaxx's equivalent of Apple's Human Interface Guidelines: one consistent, enforceable token system. Every screen spec in `06-screen-specifications.md` and every task in `10-cursor-tasks.md` must resolve to these tokens — no new one-off values are introduced during the rebuild. Implementation lands in `constants/orbit-theme.ts` (extended) per the plan's Phase B.

## 0. Relationship to existing tokens

Choremaxx already has `constants/orbit-theme.ts` (colors, spacing, radius, typography), `constants/accent-themes.ts` (9 personal accent packs), `constants/background-themes.ts` (5 background packs), and `constants/choremaxx-brand.ts` (brand marks). This document does not throw that away — it **tightens and completes** it:

- Existing dark/light semantic colors (`orbitColorsDark` / `orbitColorsLight`) become the **base** and **elevated** background/surface tiers below — accurate already, just formalized.
- Existing accent/background theme packs remain the personalization layer — the accent hierarchy below is "which accent value plays which *role*," not a replacement for the 9 packs.
- Existing spacing (`orbitSpacing`: 8/12/16/24/32/48) and radius (`orbitRadius`: 12/16/24/999) are **replaced** by the exact scales below, because they currently drift from what's documented in `docs/ux-design-system.md` (which lists 18/32 radii and 8/16/24/32/48/64 spacing) and from what screens actually use (10/14/18/20/22/26/28/80 appear ad hoc across the codebase per the UI audit). One scale, everywhere.
- Existing typography (`orbitTypography`: display/title/cardTitle/body/caption/eyebrow/metric) is **superseded** by the full Apple-style scale below, mapped 1:1 so migration is mechanical (see §2.4).

## 1. Color system

### 1.1 Background hierarchy

Three tiers, each with a dark and light value. These map directly onto the existing `background` / `backgroundSoft` / `shell` triad — we are naming their *roles*, not inventing new hex values.

| Role | Purpose | Dark | Light |
|---|---|---|---|
| `background.base` | The canvas behind everything — a screen's root. | `#070D1C` | `#F0F4F8` |
| `background.elevated` | One step up: sheets, modals, grouped sections sitting on top of base. | `#0A1525` | `#E4EBF2` |
| `background.recessed` | One step down: the outermost shell behind rounded screen corners (status bar / home-indicator zone). | `#030810` | `#D8E2EC` |

Background theme packs (Midnight/Dusk/Paper/Mist/Contrast in `constants/background-themes.ts`) each supply their own base/elevated/recessed triad — this hierarchy is the *contract* those packs must satisfy, not a fixed palette.

### 1.2 Surface hierarchy

Surfaces sit *on* a background and hold content (cards, rows, sheets). Exactly four tiers — never invent a fifth:

| Role | Purpose | Dark value | Light value |
|---|---|---|---|
| `surface.flat` | Content with no visual container at all — text living directly on the background. Default for most content; see `04-information-hierarchy.md` ("typography before containers"). | transparent | transparent |
| `surface.card` | A standard grouped card (list section, summary card). | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.78)` |
| `surface.cardStrong` | An emphasized card (the one primary card on a screen, a selected state). | `rgba(255,255,255,0.07)` | `rgba(255,255,255,0.92)` |
| `surface.floating` | Anything that floats above scroll content: tab bar, floating action button, toolbars, search field, bottom sheets. This is where **materials** (§4) apply, not flat color. | material, see §4 | material, see §4 |

Rule: **a card should never contain another card.** If a design needs nested grouping, use spacing and typography (dividers, section labels) instead of a second `surface.card` inside a `surface.card`. This directly enforces `01-product-philosophy.md`'s "invisible complexity" and is called out repeatedly in `09-ui-audit.md`.

### 1.3 Accent hierarchy

Three accent roles, filled by whichever of the 9 `ACCENT_THEMES` packs the household member has chosen:

| Role | Purpose |
|---|---|
| `accent.primary` | The member's chosen `theme.primary` — CTAs, active tab, selected state, focus rings. |
| `accent.secondary` | The member's chosen `theme.secondary` — gradient partner to primary, never used alone as a solid fill for text-bearing surfaces (contrast risk). |
| `accent.tertiary` | A always-neutral gray-blue (`textMuted`/`textSubtle`) used for "accent-shaped" UI that must stay legible regardless of which of the 9 packs is active — e.g. disabled states, placeholder icons. |

Domain accents stay **fixed** regardless of personal accent theme, because they're semantic, not personal taste: `rewardsGold` (`#FFD700`/brand gold), `novaCyan` (`#06B6D4`), `planPurple` (`#A78BFA`). A user's personal Sunset theme must never repaint the Rewards tab gold into orange — domain color communicates "this is Rewards," personal accent communicates "this is you."

### 1.4 Semantic colors

Fixed across all accent/background packs (never themed):

| Token | Dark | Light | Usage |
|---|---|---|---|
| `success` | `#34D399` | `#059669` | Completed task, positive XP, confirmed action. |
| `warning` | `#FB923C` | `#EA580C` | Due soon, low stock, needs attention (not urgent). |
| `danger` | `#F87171` | `#DC2626` | Overdue, destructive action, blocked/error. |

### 1.5 Dynamic colors (light/dark)

Choremaxx already supports both dark (`orbitColorsDark`) and light (`orbitColorsLight`) palettes plus 5 background packs on top. The rule going forward: **every new component must read colors from the active palette object, never hardcode a hex.** This is already true in most of `components/orbit/`; the audit (`09-ui-audit.md`) flags the screens that still hardcode dark-only hex values (several `#0A1525` panel backgrounds in modal screens) — those get fixed as part of each screen's batch in Phase C.

## 2. Typography

### 2.1 SF Pro usage

iOS resolves the system font to SF Pro automatically — Choremaxx should **not** bundle a custom font. Use React Native's default (`fontFamily` unset) on iOS so Dynamic Type, SF Pro Rounded-adjacent number rendering, and OS-level accessibility settings all work for free. Android falls back gracefully to Roboto; do not attempt to force SF Pro cross-platform.

### 2.2 The scale

One scale, used everywhere. Naming follows Apple's own text-style names so intent is unambiguous:

| Style | Size | Weight | Line height | Usage |
|---|---|---|---|---|
| `largeTitle` | 34 | 700 (bold) | 41 | Screen-defining title when a screen has one hero moment (Home greeting, onboarding headline). Used sparingly — most screens use `title1` in a nav-bar-style header instead. |
| `title1` | 28 | 700 | 34 | Primary screen title (nav-bar large-title collapsed state, section header for a whole tab). |
| `title2` | 22 | 700 | 28 | Sub-section headers within a screen (e.g. "Today's Tasks" header on Home). |
| `title3` | 20 | 600 (semibold) | 25 | Card-level titles, sheet titles. |
| `headline` | 17 | 600 | 22 | Emphasized body text, list-row primary label when it needs weight. |
| `body` | 17 | 400 (regular) | 22 | Default reading text. This is the **most common style in the app** — most screens over-use smaller sizes today; the rebuild corrects that (see `09-ui-audit.md`). |
| `callout` | 16 | 400 | 21 | Secondary body text, slightly de-emphasized from `body`. |
| `subheadline` | 15 | 400 | 20 | List-row secondary label, metadata line. |
| `footnote` | 13 | 400 | 18 | De-emphasized supporting text, timestamps. |
| `caption1` | 12 | 400 | 16 | Smallest readable label — badge text, tags, eyebrows (paired with `letterSpacing: 0.4` + uppercase for eyebrow usage only). |
| `caption2` | 11 | 500 (medium) | 13 | Rarely used — tab bar labels, tightest metadata. |

Two numeric styles for data-forward moments (XP totals, momentum score, streak counts):

| Style | Size | Weight | Usage |
|---|---|---|---|
| `metricLarge` | 34 | 800 (extrabold) | The one hero number on a screen (Momentum ring center, XP total on Rewards). |
| `metricSmall` | 22 | 700 | Secondary numbers next to a hero metric (weekly XP next to all-time XP). |

### 2.3 Large Titles and headline rules

- Exactly **one** `largeTitle` or `title1` per screen. If a screen wants two hero titles, it is two screens' worth of content and needs restructuring (see `04-information-hierarchy.md`, "one primary action per screen" extends to "one primary title per screen").
- Section headers inside a screen are always `title2` or `title3`, never `largeTitle` — visual hierarchy must be legible from type size alone, without relying on color or weight tricks.
- Never set a heading in a domain accent color for pure decoration. Heading color is `text` (primary reading color) by default; color is reserved for status/semantic meaning.

### 2.4 Migration map (old → new)

| Old (`orbitTypography`) | New style |
|---|---|
| `display` (24/700) | `title2` (structurally closest; screens using `display` for a hero should move to `largeTitle` or `title1` instead — check per-screen in `06-screen-specifications.md`) |
| `title` (18/700) | `title3` |
| `cardTitle` (14/600) | `headline` |
| `body` (14/400) | `subheadline` (Choremaxx's old "body" was actually secondary-sized; true `body` at 17 is new) |
| `caption` (12/400) | `footnote` |
| `pageEyebrow` / `eyebrow` | `caption1` + uppercase + `letterSpacing: 0.4` |
| `metric` (28/800) | `metricSmall` (hero metrics move up to `metricLarge` at 34) |

### 2.5 Dynamic Type

- All text components must use relative units that respect the OS text-size setting — never `allowFontScaling={false}` except for single-line numeric badges where truncation would break layout (XP capsule, tab bar count badge), and even then prefer `maxFontSizeMultiplier` over disabling scaling entirely.
- Multi-line body text must never be given a fixed `height` — always let content determine height so larger Dynamic Type settings don't clip text.
- Icon-only buttons must have accessible labels regardless of visible text scaling.

## 3. Spacing

### 3.1 The Apple spacing scale

One scale. Every margin, gap, and padding value in the app must be one of these eleven numbers — nothing else:

```
4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96
```

Semantic aliases (for readability in code, not new values):

| Alias | Value | Typical use |
|---|---|---|
| `space.xxs` | 4 | Icon-to-label gap inside a tight control. |
| `space.xs` | 8 | Gap between closely related elements (chip internal padding, tight stacks). |
| `space.sm` | 12 | Gap between a label and its input, list-row internal padding. |
| `space.md` | 16 | Default screen horizontal margin; default gap between unrelated elements. |
| `space.lg` | 20 | Card internal padding for `cardStrong` surfaces. |
| `space.xl` | 24 | Gap between distinct sections on a screen. |
| `space.xxl` | 32 | Gap above a screen's primary CTA; hero block padding. |
| `space.xxxl` | 40 | Rare — large empty-state illustrations. |
| `space.section` | 48 | Gap between major screen regions (header block vs. content block). |
| `space.screen` | 64 | Top padding for splash/onboarding hero moments. |
| `space.hero` | 96 | Reserved for full-bleed empty states / splash only. |

This replaces `orbitSpacing`'s 8/12/16/24/32/48 one-for-one for the values that already match (8→`xs`, 12→`sm`, 16→`md`, 24→`xl`, 32→`xxl`, 48→`section`) and adds the missing rungs (4, 20, 40, 64, 96) that today get filled in with arbitrary numbers per-screen.

### 3.2 Margins, safe areas, readable width

- **Screen horizontal margin:** `space.md` (16) by default. Never less. Screens with dense data (Analytics charts) may use `space.sm` (12) locally for the chart itself, but text content stays at 16.
- **Safe area:** every screen respects `useSafeAreaInsets()` for top/bottom; the existing `TAB_CHROME_BODY` / chrome-padding helpers in `orbit-theme.ts` remain the mechanism for tab-screen top padding under `GlobalHeaderChips`.
- **Readable width:** on any device wider than a standard phone (iPad, if ever supported) or landscape orientation, text content should not stretch full-width — cap at ~680pt and center. Phone portrait (the only supported width today per `supportsTablet` not being iPad-optimized) doesn't need this cap enforced yet, but components should not *assume* infinite width either (avoid `width: '100%'` when `flex: 1` would do, so the cap can be added later without a rewrite).

### 3.3 Whitespace philosophy

- Whitespace is a design material, not "wasted space to fill with another card." A calm screen has *more* negative space than a busy one, by design (this is the single biggest lever for making Choremaxx "look like a new app" — see `09-ui-audit.md`'s recurring "too many cards" finding).
- When in doubt between adding a divider/border and adding whitespace, prefer whitespace. Borders and dividers are used for genuine grouping ambiguity only, not as a default separator between every element.
- Increase spacing, don't increase container count, when a screen "feels empty." An empty-feeling screen is usually solved by breathing room and typography scale, not by adding another card.

## 4. Corner radius

One consistent, non-negotiable system. No screen introduces a radius value outside this list:

| Token | Value | Usage |
|---|---|---|
| `radius.control` | 12 | Small controls: chips, input fields, small buttons. |
| `radius.card` | 20 | Standard cards, list-row groups, most containers. |
| `radius.cardLarge` | 28 | Hero cards, sheets' top corners, the one emphasized card per screen. |
| `radius.full` | 999 | Pills, avatars, circular buttons, the floating tab bar. |

- Use `borderCurve: 'continuous'` (iOS squircle) on every radius ≥ 12 — this is already used in `GlassCard` and must propagate to every rebuilt component.
- Never mix an arbitrary radius (10, 14, 18, 22, 26 — all of which appear somewhere in the current codebase per the audit) into new code. If an existing screen's current radius doesn't map cleanly to one of the four values above, round to the nearest and accept the small visual shift — consistency wins.
- A card and the elements inside it should have a *visibly* smaller radius than the card itself (e.g. `radius.cardLarge` card containing `radius.control` chips), never equal or larger — this is what makes nested shapes read as "designed" rather than "randomly rounded."

## 5. Shadows

Shadows are used **exactly** in these situations, and nowhere else:

1. **Floating chrome** — the tab bar, a floating action button, a toast/snackbar. These need to visually separate from scrolling content beneath them.
2. **Active drag / reorder state** — an item being dragged lifts with a shadow to communicate "this is now above the surface plane."
3. **The single emphasized card** on a screen that uses `surface.cardStrong`, and only when that screen has exactly one such card (a second shadowed card competing for attention is a hierarchy bug).

Shadows are **never** used on: standard list rows, standard cards, buttons at rest, text, icons. A screen where every card has a shadow is the single fastest way to look like a generic UI-kit template rather than an Apple app — Apple's own apps are almost entirely flat, using color/material/spacing for depth instead of drop shadows.

Standard shadow recipe (dark and light need different opacity to read correctly):

| Tier | Dark mode | Light mode |
|---|---|---|
| `shadow.floating` | `shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: {height: 6}` | `shadowColor: '#0F1C2A', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: {height: 6}` |
| `shadow.lifted` (drag state) | `shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: {height: 10}` | `shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: {height: 10}` |

## 6. Materials

Full rules live in `08-liquid-glass-guidelines.md`; this section defines the four material *tiers* as design-language tokens so components can reference them by name.

| Tier | `expo-blur` intensity (iOS) | Usage |
|---|---|---|
| `material.liquidGlass` | 40–50, tint follows system appearance | Floating tab bar, floating search field, context menus — the "hero" glass moments, used sparingly. |
| `material.ultraThin` | 20–30 | Sheet headers, sticky section headers while scrolling underneath. |
| `material.thin` | 10–20 | Inline toolbars, secondary floating controls. |
| `material.opaque` | none (solid `background.elevated`) | Full-screen modals/sheets where content must never be visible through the material (forms, settings). |

Rule of thumb encoded here, expanded in `08`: **glass is chrome, not content.** A card holding a task's title and description is `surface.card` (flat translucent color), never a blur material — blur is reserved for things that float *above* content (navigation, controls, overlays).

## 7. Icons

- Use `MaterialIcons` (already the app's icon set via `@expo/vector-icons`) consistently — do not mix in a second icon family per screen. Where a more "Apple SF Symbols"-shaped icon exists under a different name in `MaterialIcons`, prefer the visually closest single-weight outline icon over a filled/duotone one, to match SF Symbols' restrained default weight.
- Icon sizes follow the type scale they sit next to: 16px icon next to `subheadline`/`footnote` text, 20px next to `body`/`headline`, 24px for a standalone icon button, 28–32px for an empty-state icon.
- Icons carry semantic color (success/warning/danger) or `textMuted`/`accent.primary` — never a hardcoded hex.
