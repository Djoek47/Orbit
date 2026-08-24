/**
 * Live `households.id` is a UUID. Mock slugs (`hh-rivera`) must never be sent
 * to Postgres — that surfaces as `invalid input syntax for type uuid` on confirm.
 */
export function isPersistedHouseholdId(id: string | null | undefined): id is string {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Revision G §0.d — silent slug→Postgres coercion is banned. */
export class InvalidHouseholdIdError extends Error {
  constructor(method: string, value: unknown) {
    super(`${method}: householdId is not a uuid (${JSON.stringify(value)})`);
    this.name = 'InvalidHouseholdIdError';
  }
}

export function assertHouseholdUuid(method: string, id: string | null | undefined): asserts id is string {
  if (!isPersistedHouseholdId(id)) {
    throw new InvalidHouseholdIdError(method, id);
  }
}

/**
 * Live (supabase) paths must throw on slugs. Mock may keep `hh-rivera`.
 */
export function liveHouseholdIdOrThrow(
  method: string,
  householdId: string | null | undefined,
  live: true
): string;
export function liveHouseholdIdOrThrow(
  method: string,
  householdId: string | null | undefined,
  live?: boolean
): string | null | undefined;
export function liveHouseholdIdOrThrow(
  method: string,
  householdId: string | null | undefined,
  live = false
): string | null | undefined {
  if (!live) return householdId;
  assertHouseholdUuid(method, householdId);
  return householdId;
}

