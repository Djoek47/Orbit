/**
 * Deferred outward effects for IUI commits (WO9 B3).
 * Writes land immediately; notify/push wait for the undo window (or app background).
 */

export type DeferredEffect = {
  id: string;
  beatId: string;
  run: () => Promise<void>;
};

type Queued = DeferredEffect & {
  runAt: number;
  timer: ReturnType<typeof setTimeout> | null;
};

const queue = new Map<string, Queued>();
let appListening = false;

function ensureAppStateFlush() {
  if (appListening) return;
  appListening = true;
  try {
    // Lazy so unit tests don't pull react-native.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } = require('react-native') as typeof import('react-native');
    AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        void effectOutbox.flushAll();
      }
    });
  } catch {
    /* node / test */
  }
}

function schedule(entry: Queued) {
  if (entry.timer) clearTimeout(entry.timer);
  const delay = Math.max(0, entry.runAt - Date.now());
  entry.timer = setTimeout(() => {
    void runOne(entry.beatId);
  }, delay);
}

async function runOne(beatId: string) {
  const entry = queue.get(beatId);
  if (!entry) return;
  queue.delete(beatId);
  if (entry.timer) clearTimeout(entry.timer);
  try {
    await entry.run();
  } catch (error) {
    console.warn('[effectOutbox] deferred effect failed', beatId, error);
  }
}

export const effectOutbox = {
  enqueue(effect: DeferredEffect, windowMs: number): void {
    ensureAppStateFlush();
    const existing = queue.get(effect.beatId);
    if (existing?.timer) clearTimeout(existing.timer);
    const entry: Queued = {
      ...effect,
      runAt: Date.now() + Math.max(0, windowMs),
      timer: null,
    };
    queue.set(effect.beatId, entry);
    schedule(entry);
  },

  discard(beatId: string): void {
    const entry = queue.get(beatId);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    queue.delete(beatId);
  },

  async flushAll(): Promise<void> {
    const ids = [...queue.keys()];
    for (const id of ids) {
      await runOne(id);
    }
  },

  pendingBeatIds(): string[] {
    return [...queue.keys()];
  },

  clearAll(): void {
    for (const entry of queue.values()) {
      if (entry.timer) clearTimeout(entry.timer);
    }
    queue.clear();
  },
};
