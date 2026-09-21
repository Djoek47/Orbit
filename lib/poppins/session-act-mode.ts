/**
 * Session flags for the current Poppins utterance / prefs.
 * actMode is stamped onto IUI beats so the meter charges from the beat.
 */

export type SessionActMode = 'silent' | 'spoken';

let sessionActMode: SessionActMode = 'silent';
let sessionDirectMode = false;
let sessionUndoMs = 5000;
let sessionHoldMultiplier = 1;
let sessionShowThinking = true;
let sessionWrittenReplies = true;
let sessionNotificationActions = true;
let sessionSelfName = '';

export function setSessionSelfName(name: string | null | undefined) {
  sessionSelfName = name?.trim() ?? '';
}

export function getSessionSelfName(): string {
  return sessionSelfName;
}

export function setSessionActMode(mode: SessionActMode) {
  sessionActMode = mode;
}

export function getSessionActMode(): SessionActMode {
  return sessionActMode;
}

export function setSessionInteractionPrefs(prefs: {
  actImmediately?: boolean;
  undoWindowSec?: number;
  confirmTimeMultiplier?: number;
  showThinking?: boolean;
  writtenReplies?: boolean;
  notificationActions?: boolean;
}) {
  if (prefs.actImmediately != null) sessionDirectMode = prefs.actImmediately;
  if (prefs.undoWindowSec != null) sessionUndoMs = prefs.undoWindowSec * 1000;
  if (prefs.confirmTimeMultiplier != null) sessionHoldMultiplier = prefs.confirmTimeMultiplier;
  if (prefs.showThinking != null) sessionShowThinking = prefs.showThinking;
  if (prefs.writtenReplies != null) sessionWrittenReplies = prefs.writtenReplies;
  if (prefs.notificationActions != null) {
    sessionNotificationActions = prefs.notificationActions;
  }
}

export function getSessionDirectMode(): boolean {
  return sessionDirectMode;
}

export function getSessionUndoMs(): number {
  return sessionUndoMs;
}

export function getSessionHoldMultiplier(): number {
  return sessionHoldMultiplier;
}

export function getSessionShowThinking(): boolean {
  return sessionShowThinking;
}

export function getSessionWrittenReplies(): boolean {
  return sessionWrittenReplies;
}

export function getSessionNotificationActions(): boolean {
  return sessionNotificationActions;
}
