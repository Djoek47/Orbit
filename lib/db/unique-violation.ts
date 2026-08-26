/** Postgres unique_violation. */
export function isUniqueViolation(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  return /duplicate|unique|23505/i.test(error.message ?? '');
}
