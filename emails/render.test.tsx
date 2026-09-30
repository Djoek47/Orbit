/**
 * Smoke-render every ChoreMaxx email template with its PreviewProps.
 * Run: npm run test:emails
 */
import { render as renderToHtml } from '@react-email/render';
import * as React from 'react';

import { EMAIL_REGISTRY } from './index';
import type { EmailModule } from './types';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const EMOJI_RANGE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

async function run() {
  const logs: string[] = [];

  for (const entry of EMAIL_REGISTRY) {
    const mod = entry.module as unknown as EmailModule<Record<string, unknown>>;
    const Component = mod.default as React.ComponentType<Record<string, unknown>> & {
      PreviewProps?: Record<string, unknown>;
    };
    const props = Component.PreviewProps;
    assert(Boolean(props), `${entry.id}: missing PreviewProps for preview server`);
    const safeProps = props as Record<string, unknown>;

    const html = await renderToHtml(React.createElement(Component, safeProps));
    assert(html.length > 200, `${entry.id}: render produced suspiciously short HTML`);
    assert(html.includes('<html'), `${entry.id}: missing <html> root`);
    assert(!EMOJI_RANGE.test(html), `${entry.id}: emoji character found in rendered HTML`);
    assert(!/@import\s+url/.test(html), `${entry.id}: external font @import found`);
    assert(!/<link[^>]+fonts\.googleapis/.test(html), `${entry.id}: Google Fonts <link> found`);
    assert(html.includes('600'), `${entry.id}: missing 600px max-width container`);

    const subject = mod.subjectFor(safeProps);
    assert(subject.length > 0, `${entry.id}: empty subject`);
    assert(!EMOJI_RANGE.test(subject), `${entry.id}: emoji in subject line`);

    const text = mod.textFor(safeProps);
    assert(text.length > 20, `${entry.id}: plain-text fallback too short`);

    logs.push(`PASS ${entry.id} — "${subject}" (${entry.status})`);
  }

  assert(
    EMAIL_REGISTRY.length === 15,
    `Expected 15 templates in registry, found ${EMAIL_REGISTRY.length}`
  );

  console.log(logs.join('\n'));
  console.log(`\n${logs.length}/15 ChoreMaxx email templates rendered cleanly`);
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
