/**
 * User-facing auth issues — specific copy + structured fields for AuthErrorBanner.
 * Never surface repository prefixes, Expo Go demo accounts, or raw provider dumps.
 */

export type AuthIssueCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limit'
  | 'email_delivery'
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
  /** First 8 characters of `sb-request-id`. The only technical string allowed on screen. */
  supportCode?: string;
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
    message: "That email and password don't match.",
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
    title: 'Too many attempts',
    message: 'Too many attempts. Try again in a few minutes.',
    actions: [
      { label: 'Open confirmation', href: '/confirm-email' },
      { label: 'Sign in', href: '/sign-in' },
    ],
  },
  email_delivery: {
    code: 'email_delivery',
    title: 'Couldn’t send confirmation email',
    message:
      'We couldn’t send a confirmation email, so the account wasn’t created. Sign in with Apple, or try email again in a few minutes.',
    actions: [{ label: 'Sign in', href: '/sign-in' }],
  },
  email_taken: {
    code: 'email_taken',
    title: 'Account already exists',
    message: "There's already an account with this email. Try signing in.",
    actions: [
      { label: 'Sign in', href: '/sign-in' },
      { label: 'Forgot password?', href: '/forgot-password' },
    ],
  },
  weak_password: {
    code: 'weak_password',
    title: 'Choose a stronger password',
    message: 'Passwords need at least 8 characters.',
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
    message: "You're offline. Check your connection and try again.",
  },
  generic: {
    code: 'generic',
    title: 'Something went wrong',
    message: 'Something went wrong on our end. Please try again.',
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
  const next = { ...AUTH_ISSUES[code], ...overrides, code };
  if (!isSafeHumanMessage(next.message)) {
    return { ...next, title: AUTH_ISSUES[code].title, message: AUTH_ISSUES[code].message };
  }
  return next;
}

export function throwAuthIssue(code: AuthIssueCode, overrides?: Partial<AuthIssue>): never {
  throw new AuthUserError(authIssue(code, overrides));
}

const DUMP_HINTS = [
  'sb-gateway',
  'sb-project-ref',
  'x-sb-error-code',
  'supabase.co',
  'unexpected_failure',
  'functionshttperror',
  'auth/v1/',
  'cf-ray',
  'alt-svc',
  'www-authenticate',
  'cloudflare',
  '"ok":false',
  '"ok": false',
  'statuscode',
];

/** True when a string is a provider dump / JSON blob, not a sentence for humans. */
export function looksLikeTechnicalDump(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (t.length > 180) return true;
  if (t.startsWith('{') || t.startsWith('[')) return true;
  const lower = t.toLowerCase();
  if (DUMP_HINTS.some((hint) => lower.includes(hint))) return true;
  if (/[a-z]+repository\./i.test(t)) return true;
  if (lower.includes('invalid input syntax')) return true;
  if (lower.includes('provider (issuer')) return true;
  return false;
}

export function isSafeHumanMessage(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  if (!t || looksLikeTechnicalDump(t)) return false;
  if (t.length > 160) return false;
  if (/https?:\/\//i.test(t)) return false;
  return true;
}

function rawAuthText(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || '';
  if (typeof err === 'object') {
    const row = err as Record<string, unknown>;
    if (typeof row.message === 'string' && row.message.trim()) return row.message;
    if (typeof row.error_description === 'string' && row.error_description.trim()) {
      return row.error_description;
    }
    if (typeof row.msg === 'string' && row.msg.trim()) return row.msg;
    try {
      return JSON.stringify(row);
    } catch {
      return '';
    }
  }
  return String(err);
}

function tryParseJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readStatus(err: unknown, text: string): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const n = Number((err as { status?: number }).status);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const parsed = tryParseJson(text);
  if (parsed) {
    const n = Number(parsed.status ?? parsed.statusCode);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const match = text.match(/"status"\s*:\s*(\d{3})/i) || text.match(/"statusCode"\s*:\s*(\d{3})/i);
  if (match?.[1]) return Number(match[1]);
  return undefined;
}

function dumpLooksLikeSignup(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('/auth/v1/signup') || lower.includes('auth/v1/signup');
}

function providerErrorCode(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const row = err as Record<string, unknown>;
  if (typeof row.code === 'string') return row.code.toLowerCase();
  if (typeof row.error_code === 'string') return row.error_code.toLowerCase();
  const parsed = tryParseJson(typeof row.message === 'string' ? row.message : '');
  if (parsed && typeof parsed.error_code === 'string') return parsed.error_code.toLowerCase();
  if (parsed && typeof parsed.code === 'string') return parsed.code.toLowerCase();
  return '';
}

function isEmailHookFailure(text: string, status: number | undefined, providerCode: string): boolean {
  const lower = text.toLowerCase();
  if (providerCode === 'unexpected_failure') return true;
  if (lower.includes('returned from hook')) return true;
  if (lower.includes('send-auth-email')) return true;
  if (lower.includes('resend failed')) return true;
  if ((status === 500 || status === 502) && dumpLooksLikeSignup(text)) return true;
  return false;
}

export function extractSupportCode(err: unknown, text = ''): string | undefined {
  const fromObject = readRequestId(err);
  const fromText = text.match(/sb-request-id["']?\s*[:=]\s*["']?([0-9a-f-]{8,})/i)?.[1];
  const raw = fromObject || fromText || '';
  const compact = raw.replace(/[^0-9a-f]/gi, '');
  if (compact.length >= 8) return compact.slice(0, 8).toLowerCase();
  if (raw.length >= 8) return raw.slice(0, 8).toLowerCase();
  return undefined;
}

function readRequestId(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const row = err as Record<string, unknown>;
  if (typeof row.requestId === 'string') return row.requestId;
  if (typeof row.request_id === 'string') return row.request_id;
  const headers = row.headers;
  if (headers && typeof headers === 'object') {
    const map = headers as Record<string, unknown>;
    const id = map['sb-request-id'] ?? map['Sb-Request-Id'];
    if (typeof id === 'string') return id;
  }
  return '';
}

function withSupportCode(issue: AuthIssue, err: unknown, text: string): AuthIssue {
  const supportCode = extractSupportCode(err, text);
  return supportCode ? { ...issue, supportCode } : issue;
}

function cannedGeneric(text: string, err?: unknown): AuthIssue {
  if (dumpLooksLikeSignup(text) || text.toLowerCase().includes('returned from hook')) {
    return withSupportCode(AUTH_ISSUES.email_delivery, err, text);
  }
  return withSupportCode(AUTH_ISSUES.generic, err, text);
}

function finalizeIssue(issue: AuthIssue): AuthIssue {
  const canned = AUTH_ISSUES[issue.code] ?? AUTH_ISSUES.generic;
  if (isSafeHumanMessage(issue.message)) return issue;
  return { ...issue, title: canned.title, message: canned.message };
}

/** Map raw Supabase / Auth errors into short user-facing copy. */
export function formatAuthError(error: { message?: string; status?: number } | null | undefined): string {
  return resolveAuthIssue(error).message;
}

export function throwMappedAuthError(error: { message?: string; status?: number } | null | undefined): never {
  throw new AuthUserError(resolveAuthIssue(error));
}

/**
 * Safe one-line copy for screens that are not the AuthErrorBanner.
 * Never returns JSON, URLs, or provider dumps.
 */
export function userFacingMessage(err: unknown, fallback: string): string {
  const issue = resolveAuthIssue(err);
  if (issue.code === 'generic') return fallback;
  return issue.message;
}

/** Resolve any thrown value into a displayable AuthIssue. */
export function resolveAuthIssue(err: unknown): AuthIssue {
  if (isAuthUserError(err)) return finalizeIssue(err.issue);
  if (isEmailNotConfirmedError(err)) {
    return authIssue('email_not_confirmed', { email: err.email });
  }
  if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
    return AUTH_ISSUES.apple_canceled;
  }

  const message = rawAuthText(err);
  const status = readStatus(err, message);
  const lower = message.toLowerCase();
  const dump = looksLikeTechnicalDump(message);
  const providerCode = providerErrorCode(err);

  if (status === 429 || isAuthRateLimitMessage(message)) {
    return withSupportCode(AUTH_ISSUES.rate_limit, err, message);
  }
  if (isEmailHookFailure(message, status, providerCode)) {
    return withSupportCode(AUTH_ISSUES.email_delivery, err, message);
  }
  if (status === 500 || status === 502 || status === 503 || lower.includes('unexpected_failure')) {
    return cannedGeneric(message, err);
  }
  if (dump) return cannedGeneric(message, err);

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
    return AUTH_ISSUES.weak_password;
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
  if (
    lower.startsWith('authrepository.') ||
    /[a-z]+repository\./i.test(message) ||
    lower.includes('invalid input syntax') ||
    lower.includes('provider (issuer')
  ) {
    return AUTH_ISSUES.generic;
  }
  if (isSafeHumanMessage(message)) {
    return authIssue('generic', { message: message.trim() });
  }
  return cannedGeneric(message, err);
}
