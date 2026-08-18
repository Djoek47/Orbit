import {
  isProfileNameComplete,
  looksLikeGeneratedAuthName,
} from '@/lib/auth/display-name';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runDisplayNameTests(): string[] {
  const logs: string[] = [];
  const pass = (name: string) => logs.push(`PASS ${name}`);

  const relay = 'fmk7t5yskh@privaterelay.appleid.com';
  assert(looksLikeGeneratedAuthName('fmk7t5yskh', relay), 'relay local-part');
  assert(!looksLikeGeneratedAuthName('Jack', relay), 'real Apple name');
  assert(looksLikeGeneratedAuthName('mugabo', 'mugabo@gmail.com'), 'email local-part');
  assert(!looksLikeGeneratedAuthName('Jack Lewis', 'mugabo@gmail.com'), 'human name');
  assert(looksLikeGeneratedAuthName('', relay), 'empty');
  assert(looksLikeGeneratedAuthName('a@b.com'), 'email as name');
  pass('1 looksLikeGeneratedAuthName');

  assert(!isProfileNameComplete('fmk7t5yskh', relay), 'incomplete relay');
  assert(isProfileNameComplete('Jack', relay), 'complete Jack');
  assert(!isProfileNameComplete('J', relay), 'too short');
  pass('2 isProfileNameComplete');

  return logs;
}

if (typeof require !== 'undefined' && require.main === module) {
  const logs = runDisplayNameTests();
  console.log(logs.join('\n'));
  console.log(`\n${logs.length} checks passed`);
}
