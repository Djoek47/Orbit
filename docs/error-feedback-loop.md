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
   both record + offer feedback.

## Rules

- Never put technical codes alone in the alert body.
- Confirmations / success alerts use `{ record: false }` so they don’t open the loop.
- Settings and other Expo modals must navigate only in the deferred `onPress`
  after `orbitAlert` dismisses (already built in).
- Cap the log (`MAX_ENTRIES`) so Support stays scannable.

## Follow-ups

- Wire remaining bare `Alert.alert` / string-only failures through `showAppError`.
- Optional: deep-link from push / crash recovery into the same Support compose.
