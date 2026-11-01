# ChoreMaxx — Typeface Migration to Bricolage Grotesque

**Goal:** migrate the entire ChoreMaxx app typeface to **Bricolage Grotesque**.

**Scope:** type family only. Do not change any colors, font sizes, line heights,
letter-spacing, spacing, layout, iconography, or copy.

---

## Step 0 — Detect the stack first

Inspect the repo and report back **before** editing anything:

- Is this React Native / Expo, or a web app (Next.js / Vite)?
- Where is the current font declared? Search the whole repo for:
  - `fontFamily`
  - `font-family`
  - `useFonts`
  - `expo-font`
  - `next/font`
  - `@font-face`
  - `tailwind.config`
  - `theme.ts`, `typography.ts`
  - any `Text` / `Typography` wrapper component
- List **every** file that currently sets a font family. I want the full list.

---

## Step 1 — Install the font (static files, not the variable file)

Bricolage Grotesque is on Google Fonts and carries `opsz` + `wdth` + `wght` axes,
so the static download ships files named like `BricolageGrotesque_48pt-Bold.ttf`.

**Use the 48pt optical size for everything** — it's the general-purpose cut.

1. Download these five weights into the project's font asset folder:

   | Weight | Style |
   |---|---|
   | 400 | Regular |
   | 500 | Medium |
   | 600 | SemiBold |
   | 700 | Bold |
   | 800 | ExtraBold |

2. Rename to clean filenames:

   ```
   BricolageGrotesque-Regular.ttf
   BricolageGrotesque-Medium.ttf
   BricolageGrotesque-SemiBold.ttf
   BricolageGrotesque-Bold.ttf
   BricolageGrotesque-ExtraBold.ttf
   ```

3. **Verify the actual PostScript name of each file before wiring it up.**
   Do not assume the family string matches the filename. Print what you find.

---

## Step 2 — Wire it up

### If React Native / Expo

- Load all five weights via `useFonts` in the root layout. Keep the splash screen
  visible until fonts are ready so there is no flash of system font.
- Create (or update) a single `typography.ts` token file exporting the family
  names. Route every style through it. **No raw font-family strings anywhere else
  in the codebase.**
- **Android gotcha:** `fontWeight` does not work with custom fonts on Android.
  Every `fontWeight: '700'` (and similar) must instead reference the correct
  family file. Convert all of them:

  | fontWeight | Family |
  |---|---|
  | 400 | `BricolageGrotesque-Regular` |
  | 500 | `BricolageGrotesque-Medium` |
  | 600 | `BricolageGrotesque-SemiBold` |
  | 700 | `BricolageGrotesque-Bold` |
  | 800 / 900 | `BricolageGrotesque-ExtraBold` |

- If there is no shared Text wrapper, create an `<AppText>` component that
  defaults to the Regular family, and replace bare `<Text>` usage with it.

### If web (Next.js / Tailwind)

- Load via `next/font/google` using the variable font, expose it as a CSS
  variable, then set it as the default sans in `tailwind.config` so no
  per-element changes are needed.

---

## Step 3 — Cover everything, including the places people forget

Apply to:

- The `choremaxx` wordmark in the app header
- Screen titles — *Rewards Center*, *Assign chores*, *Tasks*, *Homework*, *Plan*
- Section labels and eyebrows
- Segmented controls (*Rewards / Allowance / Rankings*)
- Filter chips (*Most XP*, *Most Tasks*, *Longest Streak*)
- Task rows, task group headers, and domain sheets
- XP numbers, streak counters, rank tiers, trophy names
- Achievement counters (*1/20 earned*)
- Bottom tab bar labels, including **Poppins**
- Buttons, form inputs, **placeholder text**
- Empty states, toasts, alerts, modal and bottom-sheet titles
- Onboarding, Rewards and Grocery screens

> Native inputs and buttons silently fall back to the system font if you miss
> them. Check those explicitly.

---

## Constraints

- Do not touch emoji, icons, or colors.
- Do not change the dark brown app background or the navy task sheets.
- Do not change any font sizes, line heights, or letter-spacing values.
- Do not add a second typeface — Bricolage Grotesque handles everything.
- Delete the old font files and any now-dead font loading code.

---

## Deliverables

When done, report:

1. The list of files changed
2. The PostScript names you used
3. Anything still falling back to the system font that you couldn't reach

---

## Open decision (do not action yet)

The header wordmark. Bricolage's flat-topped `a` and tight joins are exactly what
make it distinctive, but a logo usually wants a locked custom lockup rather than a
live font. Flag the wordmark separately rather than converting it silently — I'll
decide whether it stays an asset and lets Bricolage handle only the UI.
