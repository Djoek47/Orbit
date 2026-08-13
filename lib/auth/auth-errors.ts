/**
 * User-facing auth issues — specific copy + structured fields for AuthErrorBanner.
 * Never surface repository prefixes, Expo Go demo accounts, or raw provider dumps.
 */

export type AuthIssueCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limit'
  | 'email_taken'
  | 'weak_password'
  | 'missing_fields'
  | 'apple_unavailable'
  | 'apple_canceled'
  | 'network'
  | 'generic';

export type AuthIssueAction = {
  label: string;
  /** App route, e.g. /forgot-password or /welcome */
  href?: string;
};

export type AuthIssue = {
  code: AuthIssueCode;
  title: string;
  message: string;
  actions?: AuthIssueAction[];
  /** Optional email for confirm-email routing */
  email?: string;
};

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

/** Structured auth failure for polished UI banners. */
export class AuthUserError extends Error {
  readonly issue: AuthIssue;

  constructor(issue: AuthIssue) {
    super(issue.message);
    this.name = 'AuthUserError';
    this.issue = issue;
  }
}

export function isAuthUserError(err: unknown): err is AuthUserError {
  return err instanceof AuthUserError;
}

/** @deprecated Prefer AuthUserError with code rate_limit — kept for existing catches. */
export class AuthRateLimitError extends AuthUserError {
  constructor(message = AUTH_ISSUES.rate_limit.message) {
    super({ ...AUTH_ISSUES.rate_limit, message });
    this.name = 'AuthRateLimitError';
  }
}

export function isAuthRateLimitError(err: unknown): err is AuthRateLimitError | AuthUserError {
  if (err instanceof AuthRateLimitError) return true;
  return isAuthUserError(err) && err.issue.code === 'rate_limit';
}

export const AUTH_ISSUES: Record<AuthIssueCode, AuthIssue> = {
  invalid_credentials: {
    code: 'invalid_credentials',
    title: 'Couldn’t sign in',
    message: 'That email and password don’t match. Double-check both, or reset your password.',
    actions: [
      { label: 'Forgot password?', href: '/forgot-password' },
      { label: 'Get Started', href: '/welcome' },
    ],
  },
  email_not_confirmed: {
    code: 'email_not_confirmed',
    title: 'Confirm your email',
    message: 'Open the link we sent to finish setting up your account, then try again.',
    actions: [{ label: 'Open confirmation', href: '/confirm-email' }],
  },
  rate_limit: {
    code: 'rate_limit',
    title: 'Too many emails sent',
    message:
      'Please wait a few minutes, check inbox and spam, then try again. Sign in with Apple also works.',
    actions: [
      { label: 'Open confirmation', href: '/confirm-email' },
      { label: 'Sign in', href: '/sign-in' },
    ],
  },
  email_taken: {
    code: 'email_taken',
    title: 'Account already exists',
    message: 'This email is already registered. Sign in instead, or reset your password.',
    actions: [
      { label: 'Sign in', href: '/sign-in' },
      { label: 'Forgot password?', href: '/forgot-password' },
    ],
  },
  weak_password: {
    code: 'weak_password',
    title: 'Choose a stronger password',
    message: 'Use at least 6 characters. A mix of letters and numbers works best.',
  },
  missing_fields: {
    code: 'missing_fields',
    title: 'Almost there',
    message: 'Enter both your email and password to continue.',
  },
  apple_unavailable: {
    code: 'apple_unavailable',
    title: 'Apple Sign-In unavailable',
    message: 'Use email and password for now, or try Apple Sign-In again later.',
    actions: [{ label: 'Get Started', href: '/welcome' }],
  },
  apple_canceled: {
    code: 'apple_canceled',
    title: 'Sign-In canceled',
    message: 'No problem — you can try again whenever you’re ready.',
  },
  network: {
    code: 'network',
    title: 'Connection issue',
    message: 'Check your internet connection and try again.',
  },
  generic: {
    code: 'generic',
    title: 'Something went wrong',
    message: 'We couldn’t complete that. Please try again in a moment.',
  },
};

/** Legacy string used by older callers — prefer AUTH_ISSUES.rate_limit. */
export const AUTH_RATE_LIMIT_MESSAGE = AUTH_ISSUES.rate_limit.message;

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

export function authIssue(code: AuthIssueCode, overrides?: Partial<AuthIssue>): AuthIssue {
  return { ...AUTH_ISSUES[code], ...overrides, code };
}

export function throwAuthIssue(code: AuthIssueCode, overrides?: Partial<AuthIssue>): never {
  throw new AuthUserError(authIssue(code, overrides));
}

/** Map raw Supabase / Auth errors into short user-facing copy. */
export function formatAuthError(error: { message?: string; status?: number } | null | undefined): string {
  return resolveAuthIssue(error).message;
}

export function throwMappedAuthError(error: { message?: string; status?: number } | null | undefined): never {
  throw new AuthUserError(resolveAuthIssue(error));
}

/** Resolve any thrown value into a displayable AuthIssue. */
export function resolveAuthIssue(err: unknown): AuthIssue {
  if (isAuthUserError(err)) return err.issue;
  if (isEmailNotConfirmedError(err)) {
    return authIssue('email_not_confirmed', { email: err.email });
  }
  if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
    return AUTH_ISSUES.apple_canceled;
  }

  const message =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message?: string }).message ?? '')
      : err instanceof Error
        ? err.message
        : '';
  const status =
    err && typeof err === 'object' && 'status' in err
      ? Number((err as { status?: number }).status)
      : undefined;
  const lower = message.toLowerCase();

  if (status === 429 || isAuthRateLimitMessage(message)) return AUTH_ISSUES.rate_limit;
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
    return AUTH_ISSUES.email_not_confirmed;
  }
  if (
    lower.includes('invalid login') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid email or password')
  ) {
    return AUTH_ISSUES.invalid_credentials;
  }
  if (lower.includes('already registered') || lower.includes('already been registered') || lower.includes('already exists')) {
    return AUTH_ISSUES.email_taken;
  }
  if (lower.includes('password') && (lower.includes('weak') || lower.includes('least') || lower.includes('characters'))) {
    return authIssue('weak_password', { message: message || AUTH_ISSUES.weak_password.message });
  }
  if (
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network request failed')
  ) {
    return AUTH_ISSUES.network;
  }
  if (
    lower.includes('apple') &&
    (lower.includes('not enabled') || lower.includes('provider') || lower.includes('not set up'))
  ) {
    return AUTH_ISSUES.apple_unavailable;
  }
  // Strip repo prefixes / Postgres dumps if something leaked through.
  if (
    lower.startsWith('authrepository.') ||
    /[a-z]+repository\./i.test(message) ||
    lower.includes('invalid input syntax') ||
    lower.includes('provider (issuer')
  ) {
    return AUTH_ISSUES.generic;
  }
  if (message.trim()) {
    return authIssue('generic', { message: message.trim() });
  }
  return AUTH_ISSUES.generic;
}
