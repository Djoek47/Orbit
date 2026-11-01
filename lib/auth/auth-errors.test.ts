import {
  AUTH_ISSUES,
  formatAuthError,
  isAuthRateLimitMessage,
  resolveAuthIssue,
  userFacingMessage,
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

  const leaked = resolveAuthIssue(
    new Error('rewardsRepository.getRedemptions : invalid input syntax for type uuid: "hh-rivera"')
  );
  assert(leaked.code === 'generic', 'repo leak is generic');
  assert(!leaked.message.includes('hh-rivera'), 'no mock household id in banner');
  assert(!leaked.message.includes('getRedemptions'), 'no repository prefix in banner');
  pass('6 hide postgres uuid dump on confirm');

  const signupDump = resolveAuthIssue(
    new Error(
      JSON.stringify({
        ok: false,
        status: 500,
        url: 'https://dejrbufotcvcillnneo.supabase.co/auth/v1/signup?redirect_to=https://www.choremaxx.app/auth/callback',
        headers: {
          'sb-gateway-version': '1',
          'x-sb-error-code': 'unexpected_failure',
          'sb-project-ref': 'dejrbufotcvcillnneo',
        },
      })
    )
  );
  assert(signupDump.title === 'Couldn’t send confirmation email', 'signup 500 title');
  assert(signupDump.code === 'email_delivery', 'signup 500 is mailer, not generic');
  assert(!signupDump.message.includes('supabase.co'), 'no host in banner');
  assert(!signupDump.message.includes('unexpected_failure'), 'no error code in banner');
  assert(!signupDump.message.includes('{'), 'no json in banner');
  assert(signupDump.message.length < 180, 'short copy');
  const support = resolveAuthIssue({
    status: 500,
    message: 'unexpected_failure',
    headers: { 'sb-request-id': '01a0359f-2a8b-73a7-963b-6102b410db68' },
  });
  assert(support.supportCode === '01a0359f', '8-char support code');
  assert(support.message === AUTH_ISSUES.generic.message || support.code === 'generic' || support.code === 'email_delivery', 'human copy with code');
  pass('7 hide supabase signup 500 dump');

  const hookFail = resolveAuthIssue({
    status: 500,
    code: 'unexpected_failure',
    message: 'Unexpected status code returned from hook: 502',
  });
  assert(hookFail.code === 'email_delivery', 'hook 502 is email delivery');
  assert(!hookFail.message.includes('502'), 'no status in banner');
  assert(!hookFail.title.toLowerCase().includes('too many'), 'not rate limit');
  pass('10 hook 502 is not rate limit');

  const statusDump = resolveAuthIssue({ status: 500, message: 'Internal Server Error' });
  assert(statusDump.message === AUTH_ISSUES.generic.message, '500 uses generic copy');
  assert(!statusDump.message.toLowerCase().includes('internal server'), 'no http phrase');
  pass('8 status 500 is not raw http');

  const blob = userFacingMessage(
    new Error('{"ok":false,"status":500,"url":"https://example.supabase.co/auth/v1/token"}'),
    'Couldn’t sign in right now.'
  );
  assert(blob === 'Couldn’t sign in right now.', 'userFacingMessage fallback');
  pass('9 userFacingMessage swallows dumps');

  return logs;
}

if (typeof require !== 'undefined' && require.main === module) {
  const logs = runAuthErrorsTests();
  console.log(logs.join('\n'));
  console.log(`\n${logs.length} checks passed`);
}
