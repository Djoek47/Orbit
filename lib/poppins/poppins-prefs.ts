/**
 * Household Poppins interaction prefs — voice/control axes + Guided tuning.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  defaultPoppinsActMode,
  loadPoppinsActMode,
  savePoppinsActMode,
} from '@/lib/ai/poppins-mode';
import type { PoppinsActMode } from '@/lib/ai/credits';
import { TOKEN_WEIGHT_QUIET, TOKEN_WEIGHT_SPEAK_BACK } from '@/constants/poppins-ai-rates';
import { setSessionActMode, setSessionInteractionPrefs } from '@/lib/poppins/session-act-mode';

export type PoppinsConfirmTime = 'quick' | 'normal' | 'relaxed';
export type PoppinsUndoWindowSec = 5 | 10 | 15;

export type PoppinsInteractionPrefs = {
  /** Speak back on → spoken Realtime; off → Quiet (silent). */
  speakBack: boolean;
  /** Act immediately → Direct control (skip HOLD when slots filled). */
  actImmediately: boolean;
  confirmTime: PoppinsConfirmTime;
  undoWindowSec: PoppinsUndoWindowSec;
  showThinking: boolean;
  writtenReplies: boolean;
  notificationActions: boolean;
};

const PREFS_KEY = (householdId: string) => `orbit.poppins-prefs.v1.${householdId}`;

export const DEFAULT_POPPINS_INTERACTION_PREFS: PoppinsInteractionPrefs = {
  speakBack: false,
  actImmediately: false,
  confirmTime: 'normal',
  undoWindowSec: 5,
  showThinking: true,
  writtenReplies: true,
  notificationActions: true,
};

export function voiceLabel(speakBack: boolean): 'Quiet' | 'Speak back' {
  return speakBack ? 'Speak back' : 'Quiet';
}

export function controlLabel(actImmediately: boolean): 'Guided' | 'Direct' {
  return actImmediately ? 'Direct' : 'Guided';
}

export function derivedModeLine(prefs: PoppinsInteractionPrefs): string {
  const voice = voiceLabel(prefs.speakBack);
  const control = controlLabel(prefs.actImmediately);
  const tokens = prefs.speakBack ? TOKEN_WEIGHT_SPEAK_BACK : TOKEN_WEIGHT_QUIET;
  const actions = prefs.speakBack ? Math.max(1, Math.round(tokens)) : 1;
  return `Now using: ${voice} · ${control} — ${
    prefs.speakBack ? `about ${actions}` : String(actions)
  } action${actions === 1 ? '' : 's'} each`;
}

export function modeFromSpeakBack(speakBack: boolean): PoppinsActMode {
  return speakBack ? 'spoken' : 'silent';
}

export function applyPoppinsPrefsToSession(prefs: PoppinsInteractionPrefs): void {
  setSessionActMode(modeFromSpeakBack(prefs.speakBack));
  setSessionInteractionPrefs({
    actImmediately: prefs.actImmediately,
    undoWindowSec: prefs.undoWindowSec,
    confirmTimeMultiplier: holdMsMultiplier(prefs.confirmTime),
    showThinking: prefs.showThinking,
    writtenReplies: prefs.writtenReplies,
    notificationActions: prefs.notificationActions,
  });
}

type PrefsListener = (prefs: PoppinsInteractionPrefs) => void;

const prefsCache = new Map<string, PoppinsInteractionPrefs>();
const prefsListeners = new Map<string, Set<PrefsListener>>();

function clonePrefs(prefs: PoppinsInteractionPrefs): PoppinsInteractionPrefs {
  return { ...prefs };
}

function emitPoppinsPrefs(householdId: string, prefs: PoppinsInteractionPrefs): void {
  const next = clonePrefs(prefs);
  prefsCache.set(householdId, next);
  applyPoppinsPrefsToSession(next);
  const listeners = prefsListeners.get(householdId);
  if (!listeners) return;
  for (const listener of listeners) listener(next);
}

/** In-memory household prefs. Defaults until `hydratePoppinsPrefs` or `setPoppinsPrefs`. */
export function getPoppinsPrefs(
  householdId: string | null | undefined
): PoppinsInteractionPrefs {
  if (!householdId) return clonePrefs(DEFAULT_POPPINS_INTERACTION_PREFS);
  return clonePrefs(prefsCache.get(householdId) ?? DEFAULT_POPPINS_INTERACTION_PREFS);
}

/** Notifies immediately when this household is already hydrated. */
export function subscribePoppinsPrefs(
  householdId: string | null | undefined,
  listener: PrefsListener
): () => void {
  if (!householdId) return () => undefined;
  let bucket = prefsListeners.get(householdId);
  if (!bucket) {
    bucket = new Set();
    prefsListeners.set(householdId, bucket);
  }
  bucket.add(listener);
  const current = prefsCache.get(householdId);
  if (current) listener(clonePrefs(current));
  return () => {
    bucket?.delete(listener);
  };
}

/** Save, update session getters, and notify subscribers (Poppins tab, notifications). */
export async function setPoppinsPrefs(
  householdId: string | null | undefined,
  prefs: PoppinsInteractionPrefs
): Promise<void> {
  if (!householdId) return;
  emitPoppinsPrefs(householdId, prefs);
  try {
    await AsyncStorage.setItem(PREFS_KEY(householdId), JSON.stringify(prefs));
    await savePoppinsActMode(householdId, modeFromSpeakBack(prefs.speakBack));
  } catch (error) {
    console.warn('setPoppinsPrefs persist failed', error);
  }
}

/** Load from disk into the store once at app start. Not on Poppins tab mount. */
export async function hydratePoppinsPrefs(
  householdId: string | null | undefined
): Promise<PoppinsInteractionPrefs> {
  const prefs = await loadPoppinsInteractionPrefs(householdId);
  if (householdId) emitPoppinsPrefs(householdId, prefs);
  return prefs;
}

export async function loadPoppinsInteractionPrefs(
  householdId: string | null | undefined
): Promise<PoppinsInteractionPrefs> {
  if (!householdId) return { ...DEFAULT_POPPINS_INTERACTION_PREFS };
  const mode = await loadPoppinsActMode(householdId);
  let stored: Partial<PoppinsInteractionPrefs> = {};
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY(householdId));
    if (raw) stored = JSON.parse(raw) as Partial<PoppinsInteractionPrefs>;
  } catch {
    /* ignore */
  }
  return {
    ...DEFAULT_POPPINS_INTERACTION_PREFS,
    ...stored,
    speakBack: stored.speakBack ?? mode !== 'silent',
    actImmediately: stored.actImmediately === true,
  };
}

export async function savePoppinsInteractionPrefs(
  householdId: string | null | undefined,
  prefs: PoppinsInteractionPrefs
): Promise<void> {
  await setPoppinsPrefs(householdId, prefs);
}

export function holdMsMultiplier(confirmTime: PoppinsConfirmTime): number {
  switch (confirmTime) {
    case 'quick':
      return 0.75;
    case 'relaxed':
      return 1.4;
    default:
      return 1;
  }
}

export { defaultPoppinsActMode };
