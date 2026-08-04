import {
  AUTH_RATE_LIMIT_MESSAGE,
  formatAuthError,
  isAuthRateLimitMessage,
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
    formatAuthError({ message: 'email rate limit exceeded' }) === AUTH_RATE_LIMIT_MESSAGE,
    'friendly copy'
  );
  assert(formatAuthError({ status: 429, message: 'slow down' }) === AUTH_RATE_LIMIT_MESSAGE, '429');
  pass('2 formatAuthError');

  return logs;
}

if (typeof require !== 'undefined' && require.main === module) {
  const logs = runAuthErrorsTests();
  console.log(logs.join('\n'));
  console.log(`\n${logs.length} checks passed`);
}
