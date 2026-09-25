/**
 * Render helper for edge functions / tests. Turns a template's default
 * export + props into { subject, html, text } using @react-email/render.
 *
 * Usage (future edge function wiring):
 *   import { render } from './render';
 *   import * as verification from './verification';
 *   const { subject, html, text } = await render(verification, props);
 */
import { render as renderToHtml } from '@react-email/render';
import * as React from 'react';

import type { EmailModule } from './types';

export async function render<P extends object>(
  mod: EmailModule<P>,
  props: P
): Promise<{ subject: string; html: string; text: string }> {
  const Component = mod.default as React.ComponentType<P>;
  const html = await renderToHtml(React.createElement(Component, props));
  return {
    subject: mod.subjectFor(props),
    html,
    text: mod.textFor(props),
  };
}
