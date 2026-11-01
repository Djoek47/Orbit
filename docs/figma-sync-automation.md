# Figma Make → Cursor → Backend Automation

Use this document as the **Cursor Automation** system prompt (or paste it
when launching a Cloud Agent with “Sync Make”).

## Goal

When Figma Make (`4J6d4LW335tDyEDpqq3VD1`) changes:

1. Snapshot Make source into `design/make/source/`.
2. Update `design/make/SYNC_STATE.json`.
3. Port UI into Expo under `app/` and `components/orbit/`.
4. Wire any new data fields through schema → repositories → `store/orbit-store.tsx`.
5. Open a PR on branch `cursor/figma-sync-<short-slug>-c30d`.

## Preconditions

- Figma MCP authenticated in the Cursor environment.
- **Default verification is Expo Go + mock mode** (`EXPO_PUBLIC_DATA_MODE=mock`).
- Only exercise supabase staging when the user asks to validate backend wire-up.

## Agent steps (required order)

1. **Fetch design context**  
   Call Figma MCP `get_design_context` with  
   `fileKey=4J6d4LW335tDyEDpqq3VD1` and `nodeId=0:1`.

2. **Pull Make source**  
   Fetch MCP resources under  
   `file://figma/make/source/4J6d4LW335tDyEDpqq3VD1/`  
   and write/update files under `design/make/source/`.

3. **Diff & register**  
   Compute a content hash of the snapshot. If unchanged vs
   `SYNC_STATE.json.lastSourceHash`, stop (no PR). Otherwise update
   `SYNC_STATE.json` (`lastSyncedAt`, `lastSourceHash`, `screensMirrored`)
   and append a section to `design/make/CHANGELOG.md`.

4. **Port UI**  
   Translate web/Make UI to React Native (View/Text/Pressable/ScrollView).  
   Reuse `GlassCard`, `StatusPill`, `OrbitButton`, `OrbitInput`, tokens in
   `constants/orbit-theme.ts`. Do **not** paste Tailwind/DOM code.

5. **Wire backend** (non-negotiable for shipping builds)  
   For every new entity or field introduced by the design:
   - Extend `supabase/schema.sql` (and add a dated migration under
     `supabase/migrations/` when changing existing tables).
   - Extend `types/database.ts` and `types/orbit.ts` as needed.
   - Implement repository methods for **both** mock and supabase modes.
   - Expose mutations/selectors on `store/orbit-store.tsx`.
   - Never ship a new production screen that only mutates local mock state
     when data mode is supabase.

6. **Navigation**  
   Keep Make v4+ primary tabs: Home, Tasks, Groceries, Ranks, Nova.  
   Settings/Admin and Create Task stay overlays. Calendar may remain
   hidden from the tab bar unless product/Make reconcile.

7. **Verify**  
   - `npx tsc --noEmit` (or project lint) must pass.  
   - Confirm supabase repository paths do not throw
     “not implemented yet”.  
   - Open PR with title `figma-sync: <summary>` and list UI + schema/repo
     changes.

## Human gate

Automation opens PRs only. Humans merge after Expo Go visual check and
staging supabase smoke (sign-in, create task, grocery mark purchased).

## Triggers

- **Manual:** user says “sync from Figma” / “Sync Make”.
- **Scheduled:** Cursor Automation on a daily cadence until a Figma webhook
  is available.
- **Slack/Linear:** optional mention with link to the Make file.

## Failures

- If Figma MCP is `needsAuth`, stop and report that the user must
  authenticate Figma — do not invent UI from memory.
- If schema changes require destructive migrations, document them in the
  PR and do not auto-apply to production.
