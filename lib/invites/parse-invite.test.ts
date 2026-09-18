import assert from 'node:assert/strict';
import test from 'node:test';

import { buildInviteLinks, normalizeInviteCode, parseInvitePayload } from '@/lib/invites/parse-invite';

test('normalizeInviteCode pads CMX prefix', () => {
  assert.equal(normalizeInviteCode('cmx7429'), 'CMX-7429');
  assert.equal(normalizeInviteCode('CMX-7429'), 'CMX-7429');
});

test('parseInvitePayload reads app + www web links', () => {
  assert.equal(parseInvitePayload('choremaxx://join/CMX-1234'), 'CMX-1234');
  assert.equal(parseInvitePayload('https://www.choremaxx.app/join/CMX-9999'), 'CMX-9999');
  assert.equal(parseInvitePayload('https://choremaxx.app/join/cmx-8888'), 'CMX-8888');
});

test('buildInviteLinks uses www host + custom scheme', () => {
  const links = buildInviteLinks('cmx-5555');
  assert.equal(links.code, 'CMX-5555');
  assert.equal(links.deepLink, 'choremaxx://join/CMX-5555');
  assert.equal(links.webLink, 'https://www.choremaxx.app/join/CMX-5555');
});
