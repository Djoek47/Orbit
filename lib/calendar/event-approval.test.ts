import assert from 'node:assert/strict';

import {
  resolveEventApprovalStatus,
  sidekickEventNeedsApproval,
} from '@/lib/calendar/event-approval';
import { DEFAULT_MEMBER_CAPABILITIES } from '@/lib/member-capabilities';

assert.equal(sidekickEventNeedsApproval(DEFAULT_MEMBER_CAPABILITIES, 'School'), true);
assert.equal(
  sidekickEventNeedsApproval(
    { ...DEFAULT_MEMBER_CAPABILITIES, requireSidekickEventApproval: false },
    'Activity'
  ),
  false
);

assert.equal(
  resolveEventApprovalStatus({
    actorRole: 'child',
    caps: DEFAULT_MEMBER_CAPABILITIES,
    category: 'School',
  }),
  'pending'
);

assert.equal(
  resolveEventApprovalStatus({
    actorRole: 'admin',
    caps: DEFAULT_MEMBER_CAPABILITIES,
    category: 'School',
  }),
  'approved'
);

console.log('event-approval: ok');
