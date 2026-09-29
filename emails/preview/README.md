# Previewing ChoreMaxx email templates

```bash
npm run email:dev
```

Opens the React Email dev server at `http://localhost:3010` with a live,
hot-reloading preview of all 15 templates in `emails/*.tsx`, each rendered
with its `PreviewProps`. Use this to design/tweak visuals before wiring a
template to a real send.

## Adding a new template

1. Create `emails/my-email.tsx` following the pattern in any existing
   template: `export default function MyEmail(props) { ... }`, a static
   `MyEmail.PreviewProps = {...}`, plus `subjectFor` / `textFor` exports.
2. Register it in `emails/index.ts` (`EMAIL_REGISTRY`) with a `status` of
   `'wired'` or `'todo'`.
3. Run `npm run test:emails` — the smoke test asserts every registered
   template renders cleanly (no emoji, no external fonts, valid HTML,
   non-empty subject/text).
4. Run `npm run email:dev` to see it in the browser.

## Rendering for a real send

```ts
import { render } from '@/emails/render';
import * as verification from '@/emails/verification';

const { subject, html, text } = await render(verification, {
  name: 'Sarah',
  confirmUrl: '...',
});
```

See [docs/email-templates.md](../../docs/email-templates.md) for the full
catalog, brand tokens, and wiring status of each template.
