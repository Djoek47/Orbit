import assert from 'node:assert/strict';
import { checkEmail, checkPassword, cleanEmail } from './credential-input';

assert.equal(cleanEmail('  Mia@Home.COM ​'), 'mia@home.com');
assert.deepEqual(checkEmail('mia@home.com'), { ok: true, email: 'mia@home.com' });
for (const bad of ["x' OR '1'='1", 'a@b', 'mia@home.com; DROP TABLE profiles;--', '"mia"@home.com', '', 'a'.repeat(250) + '@x.com']) {
  assert.equal(checkEmail(bad).ok, false, bad);
}
assert.equal(checkPassword('correct horse battery').ok, true);
assert.equal(checkPassword("x' OR '1'='1").ok, true, 'quotes are fine in a password; it is never in SQL');
assert.equal(checkPassword('').ok, false);
assert.equal(checkPassword('a\u0000b').ok, false);
assert.equal(checkPassword('a'.repeat(129)).ok, false);
console.log('credential-input: ok');
