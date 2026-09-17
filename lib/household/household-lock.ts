const tails = new Map<string, Promise<void>>();

/**
 * Process-local exclusive lock per household.
 * Production supabase paths must also `SELECT … FOR UPDATE` the household row
 * in the same transaction — this mutex only serializes mock / in-process races.
 */
export async function withHouseholdLock<T>(householdId: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(householdId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  tails.set(householdId, prev.then(() => gate));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}
