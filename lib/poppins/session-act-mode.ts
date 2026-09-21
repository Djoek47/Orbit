/**
 * Transport that actually ran for the current utterance — stamped onto IUI beats
 * so the act meter charges Quiet vs Speak back from the beat, not AsyncStorage race.
 */

export type SessionActMode = 'silent' | 'spoken';

let sessionActMode: SessionActMode = 'silent';

export function setSessionActMode(mode: SessionActMode) {
  sessionActMode = mode;
}

export function getSessionActMode(): SessionActMode {
  return sessionActMode;
}
