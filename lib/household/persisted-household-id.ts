/**
 * Live `households.id` is a UUID. Mock slugs (`hh-rivera`) must never be sent
 * to Postgres — that surfaces as `invalid input syntax for type uuid` on confirm.
 */
export function isPersistedHouseholdId(id: string | null | undefined): id is string {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
