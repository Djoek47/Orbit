# Error → Support feedback loop

Reusable path so any failure the household sees can become a Support ticket
without hunting through logs.

## Flow

1. **Capture** — `recordAppError` writes a ring-buffer entry (`lib/errors/error-log.ts`)
   with category, title, message, optional stack/source.
2. **Show** — `orbitAlert` (or `showAppError`) displays friendly copy via
   `friendlyErrorMessage`. Raw text stays in the log for us.
3. **Offer** — Error alerts include **Send feedback** (plus Not now). Tapping it
   opens `/support?errorId=<id>` after the alert dismisses (no nested-modal freeze).
4. **Compose** — Support pre-selects that error, lets the person add a note /
   screenshots, and sends via `send-support-feedback` (Resend + ack email).
5. **Reuse** — Call sites should prefer:

   ```ts
   showAppError('Couldn’t save', detail, { source: 'places', category: 'network' });
   ```

   or plain `orbitAlert(title, message)` when `looksLikeErrorAlert` is enough —
   both record + offer feedback. Legal / network open failures use the same path
   (`openChoremaxxUrl`).

   Under Settings / Credits (Expo `presentation: 'modal'`), use **native** feedback
   so we never nest an RN Modal:

   ```ts
   await showNativeAppError("That didn't go through", error, {
     source: 'poppins-credits',
     category: 'billing',
   });
   ```

## Rules

- Never put technical codes alone in the alert body.
- Never show `[object Object]` — always `formatUnknownError` before display.
- Confirmations / success alerts use `{ record: false }` so they don’t open the loop.
- Settings and other Expo modals must navigate only in the deferred `onPress`
  after `orbitAlert` dismisses (already built in), or use `showNativeAppError`.
- Cap the log (`MAX_ENTRIES`) so Support stays scannable.

## Follow-ups

- Prefer `showAppError` / `showNativeAppError` / bare `orbitAlert` for new failures.
- Remaining intentional natives without feedback: Settings **confirm** menus only
  (`confirmCreditPackPurchase`, `confirmLeaveDevice`) — not error paths.
- Optional: deep-link from crash recovery into the same Support compose.
