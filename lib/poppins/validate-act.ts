/**
 * WO8 §3 — validateAct gate. An act never commits with a value nobody said.
 */

import type { IuiPayload, IuiScene } from '@/lib/poppins/ui-scenes';

export type ActRejection =
  | 'missing'
  | 'placeholder'
  | 'echo'
  | 'command'
  | 'unconfident';

export type ActValidation =
  | { ok: true }
  | { ok: false; slot: string; reason: ActRejection };

const PLACEHOLDERS = new Set([
  'something',
  'anything',
  'stuff',
  'thing',
  'things',
  'it',
  'this',
  'that',
  'task',
  'tasks',
  'chore',
  'chores',
  'item',
  'items',
  'todo',
  'to do',
  'untitled',
  'none',
  'n/a',
  'na',
  'unknown',
  'tbd',
  'whatever',
  'idk',
]);

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'to',
  'for',
  'of',
  'and',
  'or',
  'on',
  'in',
  'at',
  'my',
  'me',
  'please',
]);

const COMMAND_RE =
  /\b(add|create|assign|set\s+up|make|schedule|put|remind)\b/i;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean);
}

function isStopwordOnly(value: string): boolean {
  const parts = tokens(value);
  return parts.length > 0 && parts.every((part) => STOPWORDS.has(part));
}

function isEcho(value: string, utterance: string | undefined): boolean {
  if (!utterance?.trim()) return false;
  const v = normalize(value);
  const u = normalize(utterance);
  if (!v || !u) return false;
  if (v === u) return true;
  const valueTokens = tokens(value);
  const utterTokens = tokens(utterance);
  if (utterTokens.length === 0) return false;
  const overlap = valueTokens.filter((t) => utterTokens.includes(t)).length;
  return overlap / utterTokens.length >= 0.8 && valueTokens.length >= utterTokens.length * 0.8;
}

function rejectValue(
  slot: string,
  raw: string | undefined,
  opts: { utterance?: string; provisional?: boolean; allowEmpty?: boolean }
): ActValidation | null {
  const value = raw?.trim() ?? '';
  if (!value) {
    if (opts.allowEmpty) return null;
    return { ok: false, slot, reason: 'missing' };
  }
  const lower = value.toLowerCase();
  if (PLACEHOLDERS.has(lower) || value.length < 3 || isStopwordOnly(value)) {
    return { ok: false, slot, reason: 'placeholder' };
  }
  if (COMMAND_RE.test(value)) {
    return { ok: false, slot, reason: 'command' };
  }
  if (isEcho(value, opts.utterance)) {
    return { ok: false, slot, reason: 'echo' };
  }
  if (opts.provisional) {
    return { ok: false, slot, reason: 'unconfident' };
  }
  return null;
}

function primarySlot(scene: IuiScene, payload: IuiPayload): {
  slot: string;
  value: string | undefined;
  required: boolean;
} {
  if (scene === 'grocery_add') {
    const fromItems = payload.items
      ?.filter((item) => !item.dropped && item.label.trim())
      .map((item) => item.label)
      .join(', ');
    return {
      slot: 'groceryName',
      value: payload.groceryName ?? payload.title ?? fromItems,
      required: true,
    };
  }
  if (
    scene === 'task_compose' ||
    scene === 'homework_compose' ||
    scene === 'confirm' ||
    scene === 'result_mark'
  ) {
    const hasLibrary = Boolean(payload.libraryTaskId?.trim());
    return {
      slot: 'title',
      value: payload.title,
      required: !hasLibrary,
    };
  }
  return { slot: 'title', value: payload.title, required: false };
}

/**
 * Validate a beat payload immediately before commit.
 * Never substitutes — rejection means ask for that one slot.
 */
let loggedGroceryAssigneeOnce = false;

export function validateAct(payload: IuiPayload, scene: IuiScene): ActValidation {
  // Belt-and-braces: groceries are household-wide — strip any leaked assignee.
  if (scene === 'grocery_add' && payload.assignee) {
    if (!loggedGroceryAssigneeOnce) {
      loggedGroceryAssigneeOnce = true;
      console.warn(
        '[validateAct] grocery_add beat carried an assignee; stripping (programming error)'
      );
    }
    delete payload.assignee;
  }

  const write = payload.write ?? 'none';
  if (
    write !== 'create_task' &&
    write !== 'create_homework' &&
    write !== 'add_grocery' &&
    scene !== 'task_compose' &&
    scene !== 'homework_compose' &&
    scene !== 'grocery_add'
  ) {
    return { ok: true };
  }

  const { slot, value, required } = primarySlot(scene, payload);
  if (!required && !value?.trim() && payload.libraryTaskId?.trim()) {
    return { ok: true };
  }

  const rejected = rejectValue(slot, value, {
    utterance: payload.sourceUtterance,
    provisional: payload.provisional === true,
    allowEmpty: !required,
  });
  if (rejected) return rejected;

  // WO16 §1.1 — Narrow grocery never commits the mangled transcript without a chip.
  if (
    (scene === 'grocery_add' || write === 'add_grocery') &&
    payload.narrow === true &&
    !payload.selectedChipId
  ) {
    return { ok: false, slot: 'groceryName', reason: 'unconfident' };
  }

  return { ok: true };
}

/** Clear the rejected slot so Guided can remount the picker. */
export function clearRejectedSlot(
  payload: IuiPayload,
  slot: string
): IuiPayload {
  const next: IuiPayload = { ...payload, provisional: false, composeReady: false };
  if (slot === 'groceryName') {
    next.groceryName = undefined;
    if (next.title === payload.groceryName || next.title === payload.title) {
      next.title = undefined;
    }
  } else if (slot === 'title') {
    next.title = undefined;
    next.libraryTaskId = undefined;
  }
  const sources = { ...(next.slotSource ?? {}) };
  if (slot === 'title' || slot === 'groceryName' || slot === 'assignee' || slot === 'due' || slot === 'category' || slot === 'libraryTaskId') {
    delete sources[slot];
  }
  next.slotSource = sources;
  return next;
}

export class ActRejectedError extends Error {
  readonly validation: Extract<ActValidation, { ok: false }>;

  constructor(validation: Extract<ActValidation, { ok: false }>) {
    super(`act rejected: ${validation.slot} (${validation.reason})`);
    this.name = 'ActRejectedError';
    this.validation = validation;
  }
}
