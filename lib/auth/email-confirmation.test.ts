import assert from 'node:assert/strict';

import { paramsFromUrl, urlHasAuthPayload } from './auth-url-params';

assert.equal(
  paramsFromUrl('choremaxx://auth/callback?token_hash=abc&type=signup').token_hash,
  'abc'
);
assert.equal(
  paramsFromUrl('choremaxx://auth/callback#access_token=tok&refresh_token=ref').access_token,
  'tok'
);
assert.equal(urlHasAuthPayload('choremaxx://auth/callback'), false, 'bare callback has no payload');
assert.equal(urlHasAuthPayload('choremaxx://auth/callback?token_hash=x&type=signup'), true);

console.log('email-confirmation tests passed');
