/** Thrown when Supabase Auth blocks sign-in until the inbox link is used. */
export class EmailNotConfirmedError extends Error {
  readonly email: string;

  constructor(email: string) {
    super('Email not confirmed');
    this.name = 'EmailNotConfirmedError';
    this.email = email.trim();
  }
}

export function isEmailNotConfirmedError(err: unknown): err is EmailNotConfirmedError {
  return err instanceof EmailNotConfirmedError;
}

/** Thrown when Supabase Auth email send quota is hit (signup / resend / reset). */
export class AuthRateLimitError extends Error {
  constructor(message = AUTH_RATE_LIMIT_MESSAGE) {
    super(message);
    this.name = 'AuthRateLimitError';
  }
}

export function isAuthRateLimitError(err: unknown): err is AuthRateLimitError {
  return err instanceof AuthRateLimitError;
}

export const AUTH_RATE_LIMIT_MESSAGE =
  'Too many confirmation emails were sent just now. Wait a few minutes, check inbox and spam for an earlier email, then try again — or Sign in if you already confirmed. Sign in with Apple also works.';

export function isAuthRateLimitMessage(message: string | null | undefined): boolean {
  const m = (message ?? '').toLowerCase();
  return (
    m.includes('rate limit') ||
    m.includes('email rate') ||
    m.includes('over_email_send_rate_limit') ||
    m.includes('for security purposes') ||
    m.includes('only request this after') ||
    m.includes('too many requests')
  );
}

/** Map raw Supabase / Auth errors into short user-facing copy. */
export function formatAuthError(error: { message?: string; status?: number } | null | undefined): string {
  const message = error?.message?.trim() || 'Something went wrong. Try again.';
  if (error?.status === 429 || isAuthRateLimitMessage(message)) {
    return AUTH_RATE_LIMIT_MESSAGE;
  }
  return message;
}

export function throwMappedAuthError(error: { message?: string; status?: number } | null | undefined): never {
  const message = formatAuthError(error);
  if (isAuthRateLimitMessage(error?.message) || error?.status === 429) {
    throw new AuthRateLimitError(message);
  }
  throw new Error(message);
}
