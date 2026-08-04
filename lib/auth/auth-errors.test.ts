import {
  AUTH_ISSUES,
  formatAuthError,
  isAuthRateLimitMessage,
  resolveAuthIssue,
  AuthUserError,
} from '@/lib/auth/auth-errors';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runAuthErrorsTests(): string[] {
  const logs: string[] = [];
  const pass = (name: string) => logs.push(`PASS ${name}`);

  assert(isAuthRateLimitMessage('email rate limit exceeded'), 'exact supabase copy');
  assert(isAuthRateLimitMessage('Over_email_send_rate_limit'), 'status style');
  assert(!isAuthRateLimitMessage('invalid login credentials'), 'not rate limit');
  pass('1 detect rate limit messages');

  assert(
    formatAuthError({ message: 'email rate limit exceeded' }) === AUTH_ISSUES.rate_limit.message,
    'friendly rate limit'
  );
  assert(formatAuthError({ status: 429, message: 'slow down' }) === AUTH_ISSUES.rate_limit.message, '429');
  pass('2 formatAuthError');

  const invalid = resolveAuthIssue(new Error('Invalid login credentials'));
  assert(invalid.code === 'invalid_credentials', 'invalid code');
  assert(!invalid.message.toLowerCase().includes('orbit.test'), 'no demo email leak');
  assert(!invalid.message.toLowerCase().includes('expo go'), 'no expo go leak');
  pass('3 invalid credentials professional');

  const taken = resolveAuthIssue(new Error('User already registered'));
  assert(taken.code === 'email_taken', 'email taken');
  pass('4 email taken');

  const structured = resolveAuthIssue(new AuthUserError(AUTH_ISSUES.invalid_credentials));
  assert(structured.title === 'Couldn’t sign in', 'structured title');
  pass('5 AuthUserError passthrough');

  return logs;
}

if (typeof require !== 'undefined' && require.main === module) {
  const logs = runAuthErrorsTests();
  console.log(logs.join('\n'));
  console.log(`\n${logs.length} checks passed`);
}
