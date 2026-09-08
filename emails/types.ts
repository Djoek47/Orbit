import type { ComponentType } from 'react';

/**
 * Contract every template in `emails/*.tsx` follows so `render.ts` and the
 * smoke test can treat all 15 uniformly.
 */
export type EmailModule<P> = {
  default: ComponentType<P> & { PreviewProps?: P };
  subjectFor: (props: P) => string;
  textFor: (props: P) => string;
};
