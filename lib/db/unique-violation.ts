/** Postgres unique_violation. */
export function isUniqueViolation(
  error: { code?: string; message?: string; details?: string } | null | undefined
): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  const blob = `${error.message ?? ''} ${error.details ?? ''}`;
  return /duplicate|unique|23505|already exists/i.test(blob);
}
