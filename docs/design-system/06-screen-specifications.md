# 06 — Screen Specifications

> Skeleton entry for every route in `app/`. Each entry covers Purpose, Primary Goal, Hierarchy, Interactions, Animations, Accessibility, and Remove/Simplify/Keep, per the plan's "full skeleton now, detail filled per batch" rule. Entries for screens whose batch has already executed are marked **[Detailed]**; all others are **[Skeleton]** and get expanded to full paragraph detail immediately before their batch (`10-cursor-tasks.md`) executes. Batches match `docs/design-system/README` ordering used across this suite and the plan's Phase C.

Legend: **P** Purpose · **G** Primary goal · **H** Hierarchy (primary/secondary/hidden per `04-information-hierarchy.md`) · **I** Interactions · **A** Animations · **X** Accessibility · **R** Remove · **S** Simplify · **K** Keep.

## Batch 1 — Tabs

### Home — `app/(tabs)/index.tsx` [Skeleton]
- **P** Household status surface; the first thing anyone sees when opening the app.
- **G** Answer "what does today need from me" in one glance.
- **H** Primary: today's task/grocery/event state as one narrative. Secondary: Nova Morning Brief line, personal streak. Hidden: full rankings, full task list, per-member detail.
- **I** Tap "Open tasks" / "Groceries" / "Upcoming" chips to drill in; tap avatar for persona switch.
- **A** Morning Brief fades in on load (`motion.settle`); task-count changes animate via `motion.smooth`.
- **X** Greeting + status readable as one sentence by screen reader; chips individually labeled.
- **R** Standalone Nova chat-entry card, always-visible full rankings podium above the fold, `groceryEmoji` ad hoc lookup styling.
- **S** Merge Today's Tasks + grocery/event chips into one unified "Today" section per `04-information-hierarchy.md` §5.
- **K** Header greeting/avatar/persona-switch chrome; `useTabChromePaddingTop` pattern.

### Tasks — `app/(tabs)/tasks.tsx` [Skeleton]
- **P** Full household task list, actionable.
- **G** Complete or triage tasks quickly.
- **H** Primary: today/overdue tasks. Secondary: upcoming, by-room grouping. Hidden: full history, per-assignee filters (behind search/filter).
- **I** Tap row to open detail; long-press for context menu (complete/reassign/delete); swipe for quick-complete.
- **A** Checkbox fill + strikethrough on complete; row remove animates height collapse.
- **X** Row announces title + assignee + due state + completion toggle.
- **R** Hand-rolled per-row layout duplicating Home's preview logic.
- **S** Adopt shared Task Row (`05-component-library.md`); group by day with sticky headers.
- **K** Underlying task-completion logic/store calls.

### Plan — `app/(tabs)/plan.tsx` + `plan-trips-panel.tsx` [Design 8 glass]
- **P** Calendar + itineraries in one place.
- **G** See what's happening and where, plan a trip if useful.
- **H** Itineraries: **Smart Trips | My Places** segment; glass trip cards with step timeline (`RouteSteps`).
- **I** Tap event for detail; expand trip for route steps; My Places for pickups.
- **A** Trip-suggestion surfaces as a Nova Smart Recommendation card fade-in, not a persistent nudge card.
- **X** Event rows announce time + title + location; steps announce stop labels.
- **R** Opaque gradient trip cards without glass step timeline.
- **S** Design 8 glass itineraries + My Places pickup summary.
- **K** Event/itinerary data, `RouteSteps`, `buildPickupSummary`, `suggestItinerarySummary`.

### Rewards — `app/(tabs)/rewards.tsx` [Skeleton]
- **P** Rewards, allowance, and rankings.
- **G** See progress/earnings and redeem/manage rewards.
- **H** Primary: personal XP/streak ring. Secondary: available rewards. Hidden: full allowance ledger, full rankings list (behind "See all").
- **I** Tap reward to redeem/request; admin long-press for manage/edit/archive; tap ring for detail.
- **A** Ring fill `motion.settle`; reward redemption uses existing `reward-claim-press.tsx` hold-to-claim, retained.
- **X** Ring exposes percentage as `accessibilityValue`; reward cards announce cost + availability.
- **R** ~46 inline fontSize values; duplicate rankings implementation vs. Home's preview.
- **S** One shared `Leaderboard` component (`05-component-library.md`) used here and on Home; Fitness-ring-first layout per `11-reverse-engineering-apple-apps.md`.
- **K** Allowance grant/request/approve business logic; admin test-mint/redeem capability.

### Nova — `app/(tabs)/nova.tsx` [Skeleton]
- **P** Apple-Intelligence-style household awareness surface (full reframe per `07-nova-experience.md`).
- **G** Show what Nova has already noticed; let the user act in one tap or ask a follow-up.
- **H** Primary: briefing feed (Morning Brief/Evening Wrap-up/Recommendations). Secondary: "Ask Nova" entry. Hidden: full chat transcript, activity/monitor log.
- **I** Tap a briefing card's action button; tap "Ask Nova" to open chat fallback; long-press card for "..." → History.
- **A** New briefing card `motion.settle` fade/slide-in.
- **X** Briefing text readable as one paragraph; action buttons individually labeled.
- **R** Chat/Activity segmented top-level split as the default view.
- **S** Briefing-feed-first structure; Activity demoted to detail view.
- **K** Voice input pipeline (Realtime/Whisper), Nova orb states for the chat fallback mode.

## Batch 2 — Onboarding / Auth

### Welcome / onboarding — `app/welcome.tsx` [Design 8 glass]
- **P** Role → motivation → account → profile → household → invite, single flow.
- **G** Get a new household or member set up with minimal friction.
- **H** One field-group per step; large-title headlines; perk chips on role cards.
- **I** Step-by-step continue buttons; swipe-back gesture (existing `PanResponder`).
- **A** Segment progress bars; fade step transitions; ambient glow on splash/ready.
- **X** Each step's heading readable as the step's purpose.
- **R** Flat pre-glass cards; emoji-only role rows without perks.
- **S** Translucent glass surfaces + AuthShell ambient; copy refreshed (Design 8).
- **K** Step machine, swipe-back gesture, Apple/email account creation, room multi-select.

### Sign in — `app/sign-in.tsx` [Skeleton]
- **P** Returning-user auth entry.
- **G** Get signed in with minimum friction; recover gracefully from errors.
- **H** Primary: email/password fields + sign-in button. Secondary: Apple button. Hidden: demo-mode hint (mock only).
- **I** Sign in; Apple button; links to forgot-password/get-started.
- **A** Success state animation (existing `sign-in-success.tsx`) retained.
- **X** Errors surfaced as accessible text, not just color.
- **R** n/a — recently rebuilt for TestFlight; visual token pass only.
- **S** n/a.
- **K** Friendly-error mapping, Apple/email flows, mock-demo-hint logic.

### Confirm email — `app/confirm-email.tsx` [Skeleton]
- **P** Bridge screen while waiting on Supabase email confirmation.
- **G** Make "check your email" feel like progress, not a dead end.
- **H** Primary: instructions + continue/resend actions.
- **I** Resend, continue-after-confirming, deep-link auto-continue.
- **A** Calm mail-icon card, no loading spinners beyond button state.
- **X** Status/error text always accessible.
- **R/S** Token pass only — recently built.
- **K** Resend + deep-link auth-callback logic.

### Forgot password — `app/forgot-password.tsx` [Skeleton]
- **P** Password recovery entry.
- **G** Get a reset email sent with minimum friction.
- **H** Primary: email field + send button.
- **I/A/X** Standard form pattern, matches Sign In treatment.
- **R/S** Token pass only.
- **K** Existing repository call.

### Select profile — `app/select-profile.tsx` [Skeleton]
- **P** Shared-device "who's using this" picker.
- **G** Fast, large-target person selection for kids/shared tablets.
- **H** Primary: grid of person avatars/names.
- **I** Tap to select; haptic on selection (existing).
- **A** Selection scale/haptic feedback, retained.
- **X** Each option is name + role, large touch target (kid-usable).
- **R/S** Token pass only.
- **K** Shared-device selection logic.

### Pending approval — `app/pending-approval.tsx` [Skeleton]
- **P** Waiting-room state after requesting to join a household.
- **G** Reassure the user their request is in progress.
- **H** Primary: status message + illustration/icon.
- **I** Minimal — maybe a cancel/leave action.
- **A** Calm pulsing/idle state icon if any.
- **X** Status readable as plain text.
- **R/S** Token pass only.
- **K** Underlying join-request polling logic.

## Batch 3 — Household setup

### Create household — `app/create-household.tsx` [Skeleton]
- **P** Name → type → rooms → create.
- **G** Set up a new household with sensible defaults.
- **H** Primary: current step's field. Secondary: progress indicator.
- **I** Multi-select rooms, custom room add.
- **A** Step transitions matching welcome.tsx's language.
- **X** Room chips individually toggleable/labeled.
- **R/S** Consolidate any inline styling into shared Input/Segmented Control.
- **K** Room selection + `CreateHouseholdInput.rooms` wiring.

### Join household — `app/join-household.tsx` [Skeleton]
- **P** Join via invite code.
- **G** Get in with minimum typing (code paste/QR).
- **H** Primary: code field + join button. Secondary: QR scan entry.
- **I/A/X** Standard form + camera permission flow.
- **R/S** Token pass only.
- **K** Invite-parsing logic (`lib/invites/parse-invite.ts`).

### Invite household — `app/invite-household.tsx` [Skeleton]
- **P** Generate/share an invite for a new member.
- **G** Get an invite link/QR/code in front of the right person fast.
- **H** Primary: QR + code. Secondary: share sheet entry.
- **I/A/X** Share sheet, copy-to-clipboard feedback.
- **R/S** Token pass only.
- **K** `shareInvite`/`buildInviteLinks` logic.

### Household members — `app/household-members.tsx` [Skeleton]
- **P** Roster management.
- **G** See who's in the household and manage roles/access.
- **H** Primary: member list. Secondary: pending approvals. Hidden: per-member management (context menu/detail).
- **I** Long-press/context menu for role change, remove, unlink.
- **A** List reorder/remove animations.
- **X** Each row announces name + role + status.
- **R/S** Consolidate role-badge styling into Status Chip.
- **K** Approve/decline/role-update business logic.

### Setup kid device — `app/setup-kid-device.tsx` [Skeleton]
- **P** Configure a shared/kid device profile.
- **G** Fast, low-text setup for a device that isn't the admin's own.
- **H** Primary: device label + linked profiles.
- **I/A/X** Simple form, large targets (kid/shared-device context).
- **R/S** Token pass only.
- **K** Shared-device linking logic.

## Batch 4 — Create / modal flows

### Create task — `app/create-task.tsx` [Skeleton]
- **P** New task creation/edit.
- **G** Create a task in as few decisions as possible.
- **H** Currently many fields at once (~54 inline fontSize values, highest in app) — needs progressive disclosure.
- **I** Multi-step per `04-information-hierarchy.md` §2: title → assignee/room → schedule/XP → review.
- **A** Step transitions matching welcome.tsx.
- **X** Each step's primary field auto-focused, clearly labeled.
- **R** Single long-form "everything visible" layout.
- **S** Break into discrete steps; smart defaults (assignee, XP) reduce required taps.
- **K** Underlying `CreateTaskInput`/store logic.

### Add grocery — `app/add-grocery.tsx` [Skeleton]
- **P** Add a missing/low item.
- **G** Frictionless single-item entry (per `docs/ux-design-system.md`'s existing "near-frictionless" rule).
- **H** Primary: item name + storage location. Secondary: quantity/note.
- **I/A/X** Category-driven default location (existing `locationForGroceryCategory`), quick-add.
- **R/S** Token pass; verify still minimal-friction after restyle.
- **K** Category/location defaulting logic.

### Scan grocery — `app/scan-grocery.tsx` [Skeleton]
- **P** Barcode scan → product lookup.
- **G** Add an item without typing.
- **H** Primary: camera viewfinder. Secondary: manual fallback entry.
- **I/A/X** Camera permission flow, scan-success haptic/animation.
- **R/S** Token pass only.
- **K** Barcode scanning + product catalog lookup.

### Create event — `app/create-event.tsx` [Skeleton]
- **P** New calendar event.
- **G** Quick event entry with location/time.
- **H** Primary: title/date/time. Secondary: location/responsible.
- **I/A/X** Standard form pattern.
- **R/S** Progressive disclosure if field count is high; verify during batch.
- **K** Event creation logic.

### Create itinerary — `app/create-itinerary.tsx` [Skeleton]
- **P** Multi-stop trip builder.
- **G** Assemble a trip from saved places/events/stores with minimal typing.
- **H** Primary: stop selection chips. Secondary: nearby suggestions, optimize action.
- **I** Toggle stop chips; "Manage" places link (existing); optimize with Nova.
- **A** Chip selection `motion.snappy`.
- **X** Each chip announces place name + selected state.
- **R/S** Verify chip-heavy layout doesn't violate "no dashboard mentality" as stop count grows.
- **K** `optimizeDraftStops`, `findNearbyStores`, saved-places integration.

### Create reward — `app/create-reward.tsx` [Skeleton]
- **P** Mint a new reward.
- **G** Define a reward with cost/category quickly.
- **H** Primary: title/cost. Secondary: category/emoji/color.
- **I/A/X** Standard form; progressive disclosure candidate (~46 fontSize values on the Rewards tab suggest this flow may share the issue).
- **R/S** Step-based disclosure if field count is high.
- **K** Reward creation/assignment logic.

### Grant allowance — `app/grant-allowance.tsx` [Skeleton]
- **P** Admin grants allowance to a member.
- **G** Quick amount + recipient selection.
- **H** Primary: amount + recipient. Secondary: note/schedule.
- **I/A/X** Standard form.
- **R/S** Token pass only.
- **K** Allowance grant business logic.

### Special reward request — `app/special-reward-request.tsx` [Skeleton]
- **P** Child requests a reward not in the catalog.
- **G** Let a child ask for something specific, low-friction.
- **H** Primary: request text + optional cost guess.
- **I/A/X** Simple form, kid-appropriate copy/targets.
- **R/S** Token pass only.
- **K** Request/notify-admin logic.

### Shopping mode — `app/shopping-mode.tsx` [Skeleton]
- **P** In-store checklist mode.
- **G** Fast check-off while physically shopping.
- **H** Primary: current list, check-off targets large.
- **I/A/X** Large tap targets, minimal chrome, haptic per check.
- **R/S** Verify chrome is minimal (this screen should be the calmest/most focused in the app).
- **K** List-sync logic.

### Reward tally — `app/reward-tally.tsx` [Skeleton]
- **P** Settlement/summary of redeemed rewards.
- **G** Clear accounting view.
- **H** Primary: tally total. Secondary: itemized list.
- **I/A/X** Standard list + summary header.
- **R/S** Token pass only.
- **K** Tally calculation logic.

### Shopping recommendations — `app/shopping-recommendations.tsx` [Skeleton]
- **P** Store suggestions based on missing items.
- **G** Pick a preferred store or start a trip.
- **H** Primary: recommended store card(s). Secondary: "start trip" action.
- **I/A/X** Tap to set preferred; existing "start trip" flow retained.
- **R/S** Reframe as a Nova Smart Recommendation surface per `07-nova-experience.md` where contextually shown from Groceries/Plan, not only as a standalone modal.
- **K** `findNearbyStores`/OSM lookup logic.

### My Places — `app/places.tsx` + `components/orbit/my-places-panel.tsx` [Design 8]
- **P** Manage saved places (home/work/stops/shops) with pickup lists.
- **G** Quick add/edit of key addresses; see grocery-linked pickup summary.
- **H** Primary: place cards + Pickup Summary. Secondary: category filters, favorites.
- **I/A/X** Edit sheet (emoji, kind, pickups, location); summary CTA → shopping / trip.
- **R** Flat address book without grocery connection.
- **S** Glass cards; Plan → Itineraries embeds My Places panel.
- **K** `SavedPlace.pickupItemNames`, `buildPickupSummary`, grocery Missing/Low merge.

## Batch 5 — Settings / notifications

### Settings — `app/settings.tsx` [Design 8 glass]
- **P** All account/household/appearance/notification controls.
- **G** Find and change a setting quickly.
- **H** Glass `SectionCard` / chevron rows; unified palette wheel + Day/Night/System.
- **I** Navigate into members/rooms/notifications; palette + maps segmented controls.
- **A** Segmented control selection slide.
- **X** Every row/toggle has an accessible label + current-state announcement.
- **R** Separate accent + background pickers.
- **S** Design 8 AdminScreen glass language; My Places entry.
- **K** `updatePalette`, `appearanceMode`, admin/permission logic.

### Notifications — `app/notifications.tsx` [Skeleton]
- **P** Notification center/history.
- **G** Scan and act on recent notifications.
- **H** Primary: unread grouped by recency. Secondary: read history.
- **I** Long-press context menu (mark read/open/dismiss) per `03-motion-interaction.md` §4.
- **A** Sticky date-section headers (`material.ultraThin`).
- **X** Each row announces category + read state.
- **R/S** Verify list-row consistency with shared Task/notification row pattern.
- **K** Existing deep-link/mark-read logic.

### Household balance — `app/household-balance.tsx` [Skeleton]
- **P** Household Health / mental-load detail.
- **G** Understand load distribution at a glance, then drill in.
- **H** Primary: headline metric (Completion/Grocery Load/Plan Load). Secondary: per-member breakdown.
- **I/A/X** Tap a metric for its detail; ring/metric animate on load.
- **R/S** Verify against "no dashboard mentality" — one hero metric, not three equal-weight cards.
- **K** `buildHomeHealthMetrics` logic.

### Household games — `app/household-games.tsx` [Skeleton]
- **P** Optional household games/activities list.
- **G** Discover and launch a household game.
- **H** Primary: game list/cards.
- **I/A/X** Standard card-tap-to-launch pattern.
- **R/S** Token pass only.
- **K** Existing game catalog data.

## Batch 6 — Detail / stack screens

### Task detail — `app/task/[id].tsx` [Skeleton]
- **P** Full task detail/edit/complete.
- **G** Complete, edit, or understand a task's full context.
- **H** Primary: title/status/complete action. Secondary: assignee/room/XP/schedule. Hidden: proof photo, history (behind tabs/scroll).
- **I** Matched-geometry entry from its list card (`03-motion-interaction.md` §3); complete/cancel/delete actions.
- **A** Matched geometry; completion celebration (existing XP feedback).
- **X** Full detail announced in logical reading order.
- **R/S** Verify confirm-dialog pattern (`confirmDelete`/`confirmCancel`) matches iOS alert conventions.
- **K** Task completion/XP-award business logic.

### Event detail — `app/event/[id].tsx` [Skeleton]
- **P** Full event detail/edit.
- **G** Understand/edit an event's specifics.
- **H** Primary: title/date/time/location. Secondary: responsible person.
- **I/A/X** Matched-geometry entry; standard edit form.
- **R/S** Token pass only.
- **K** Event edit logic.

### Itinerary detail — `app/itinerary/[id].tsx` [Detailed]
- **P** Execute one trip: get to the current stop, do the thing, mark arrived. Product logic: `docs/itinerary-ux.md`, `lib/itinerary/trip-intent.ts`.
- **G** Answer “where do I go now?” in one glance; hand off to Maps; advance on “I’m here.”
- **H** Primary: current stop + Directions. Secondary: I’m here, Open list (grocery only). Hidden until needed: Coming up (2+ remaining), Edit route, Done recap, Run again (completed). Preferred lives in the header star, not a footer chip.
- **I** Directions opens Maps. I’m here completes the stop (no confirm) and opens the next leg. Coming-up tap = directions there; long-press = Go here next. Edit route discloses reorder handles on remaining stops. Star toggles preferred.
- **A** Existing button press only; haptic Medium on I’m here. No extra chrome motion.
- **X** Back to Plan; star selected state; 52pt CTAs; coming-up rows 44pt; never expose lat/lng to VoiceOver.
- **R** Duplicate Route / Current stop / Reorder lists; “1 stops”; Active/0/1 chips; “Start trip in Maps” + “Open this stop” as two names for Directions; coordinate address lines.
- **S** One hero for one remaining stop. Lists exist only when they add information the hero does not already say.
- **K** `openFullItineraryInMaps`, `openStopInMaps`, `advanceItineraryStop`, `reorderItineraryStops`, `toggleItineraryFavorite`, `rerunItinerary`.

### Momentum — `app/momentum.tsx` [Skeleton]
- **P** Momentum score detail.
- **G** Understand the household's momentum trend.
- **H** Primary: momentum ring + trend. Secondary: contributing factors.
- **I/A/X** Ring animates on load; trend explained in plain text.
- **R/S** Fitness-ring-first framing per `11`.
- **K** Momentum calculation logic.

### Badge gallery — `app/badge-gallery.tsx` [Skeleton]
- **P** Earned/available badges showcase.
- **G** Celebrate earned badges, show what's next.
- **H** Primary: earned badges grid. Secondary: locked/upcoming badges.
- **I/A/X** Tap for badge detail/story; unlock reveal animation retained.
- **R/S** Token pass only.
- **K** Badge unlock logic.

### Weekly report — `app/weekly-report.tsx` [Skeleton]
- **P** Weekly household summary.
- **G** Understand the week's effort distribution and highlights.
- **H** Primary: headline summary sentence (Household Summary, `07-nova-experience.md`). Secondary: per-member/domain breakdown.
- **I/A/X** Scrollable report, shareable.
- **R/S** Lead with a Journal-style calm summary sentence, not a chart-first layout.
- **K** Underlying weekly aggregation logic.

### Analytics — `app/analytics.tsx` [Skeleton]
- **P** Deeper household data/trends.
- **G** Let an interested admin dig into trends.
- **H** Primary: one headline chart/metric at a time. Secondary: filters/date range.
- **I/A/X** Chart interactions, filter controls.
- **R/S** Verify "no dashboard mentality" — this is the one screen allowed more data density, but still one focus at a time via tabs/sections, not all charts simultaneously.
- **K** Underlying analytics data pipeline.

### Smart home — `app/smart-home.tsx` [Skeleton]
- **P** Placeholder smart-home integration screen.
- **G** Communicate "coming soon" clearly and calmly.
- **H** Primary: status/coming-soon message.
- **I/A/X** Minimal — mostly static.
- **R/S** Token pass only.
- **K** Placeholder framing (matches `docs/ecosystem/watch-vision-roadmap.md` platform-roadmap positioning).

## Cross-reference

- Batches match the plan's Phase C execution order and `10-cursor-tasks.md`'s batch structure.
- Redirect-only routes (`onboarding.tsx`, `sign-up.tsx`, `create-profile.tsx`, `household-setup.tsx`, `join/[code].tsx`) are not separately specified here — they have no visual surface of their own and are out of scope for this suite.
