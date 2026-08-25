/**
 * Speak continuity — the household conversation survives hangup.
 * WebRTC still tears down; this is what Luna / the stage resume from.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { IuiBeat, IuiPhase, IuiScene, IuiWriteKind } from '@/lib/poppins/ui-scenes';

export const IUI_CONTINUITY_TTL_MS = 4 * 60 * 60 * 1000;
const KEY = 'choremaxx.iui.continuity.v1';
const MAX_TURNS = 6;

export type IuiContinuityTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type IuiContinuity = {
  householdId: string;
  updatedAt: number;
  lastAssignee?: string;
  lastTitle?: string;
  lastScene?: IuiScene;
  lastWrite?: IuiWriteKind;
  turns: IuiContinuityTurn[];
  openPlaylist?: IuiBeat[];
  openIndex?: number;
  openFrozen?: boolean;
};

export function isContinuityFresh(
  record: IuiContinuity | null | undefined,
  now = Date.now()
): boolean {
  if (!record?.householdId || !record.updatedAt) return false;
  return now - record.updatedAt < IUI_CONTINUITY_TTL_MS;
}

/** 4h skip helper. Product opening (listen / presence / situation) is decideOpening. */
export function shouldGreet(
  record: IuiContinuity | null | undefined,
  householdId: string | null | undefined
): boolean {
  const id = householdId?.trim();
  if (!id) return true;
  return !isContinuityFresh(record) || record?.householdId !== id;
}

export function rememberTurn(
  record: IuiContinuity | null | undefined,
  householdId: string | null | undefined,
  turn: IuiContinuityTurn
): IuiContinuity {
  const id = householdId?.trim() || 'unknown';
  const text = turn.text.trim();
  const base: IuiContinuity = record?.householdId === id
    ? { ...record, turns: [...record.turns] }
    : { householdId: id, updatedAt: Date.now(), turns: [] };
  if (!text) {
    return { ...base, updatedAt: Date.now() };
  }
  const last = base.turns[base.turns.length - 1];
  if (last && last.role === turn.role) {
    last.text = text;
  } else {
    base.turns.push({ role: turn.role, text });
  }
  if (base.turns.length > MAX_TURNS) {
    base.turns = base.turns.slice(-MAX_TURNS);
  }
  return { ...base, updatedAt: Date.now() };
}

export function snapshotFromDrive(
  record: IuiContinuity | null | undefined,
  householdId: string | null | undefined,
  drive: {
    live: boolean;
    playlist: IuiBeat[];
    index: number;
    frozen: boolean;
    holding: boolean;
    phase: IuiPhase;
  }
): IuiContinuity {
  const id = householdId?.trim() || 'unknown';
  const beat = drive.playlist[drive.index];
  const next: IuiContinuity = {
    householdId: id,
    updatedAt: Date.now(),
    turns: record?.householdId === id ? record.turns : [],
    lastAssignee: beat?.payload.assignee || record?.lastAssignee,
    lastTitle: beat?.payload.title || record?.lastTitle,
    lastScene: beat?.scene || record?.lastScene,
    lastWrite: beat?.payload.write || record?.lastWrite,
  };
  const keepOpen = drive.live && (drive.holding || drive.frozen || drive.phase === 'hold');
  if (keepOpen && drive.playlist.length) {
    next.openPlaylist = drive.playlist;
    next.openIndex = drive.index;
    next.openFrozen = true;
  }
  return next;
}

export function hasOpenAct(record: IuiContinuity | null | undefined): boolean {
  return Boolean(isContinuityFresh(record) && record?.openPlaylist?.length);
}

/** Frozen stage snapshot — do not arm HOLD until Speak is actually listening. */
export function openActSnapshot(
  record: IuiContinuity | null | undefined,
  holdMs: number
): {
  playlist: NonNullable<IuiContinuity['openPlaylist']>;
  index: number;
  phase: 'unfold';
  frozen: true;
  holdMs: number;
  thinkingLine: string;
} | null {
  if (!hasOpenAct(record) || !record?.openPlaylist?.length) return null;
  return {
    playlist: record.openPlaylist,
    index: record.openIndex ?? 0,
    phase: 'unfold',
    frozen: true,
    holdMs,
    thinkingLine: record.lastTitle ?? '',
  };
}

/** Instructions for the next realtime session — never a fresh “hi I’m Poppins”. */
export function continuityListenPrompt(record: IuiContinuity): string {
  const bits: string[] = ['Do not greet. Continue this household session and listen.'];
  if (record.lastTitle && record.lastAssignee) {
    bits.push(`Last act: ${record.lastTitle} for ${record.lastAssignee}.`);
  } else if (record.lastTitle) {
    bits.push(`Last act: ${record.lastTitle}.`);
  }
  if (record.openPlaylist?.length) {
    bits.push('An assignment is still on screen. Wait for silence or a revision. Do not start over.');
  }
  const recent = record.turns
    .slice(-4)
    .map((turn) => `${turn.role === 'user' ? 'They' : 'You'}: ${turn.text}`)
    .join(' ');
  if (recent) bits.push(`Recent: ${recent}`);
  return bits.join(' ');
}

export async function loadIuiContinuity(
  householdId: string | null | undefined
): Promise<IuiContinuity | null> {
  const id = householdId?.trim();
  if (!id) return null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IuiContinuity;
    if (!isContinuityFresh(parsed) || parsed.householdId !== id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveIuiContinuity(record: IuiContinuity): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* ignore */
  }
}

export async function clearIuiContinuity(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
