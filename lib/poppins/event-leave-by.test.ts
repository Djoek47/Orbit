/**
 * Pre-TF B2 — leave-by never invents drive time; requires a real clock form.
 * Run: npx --yes tsx lib/poppins/event-leave-by.test.ts
 */
import assert from 'node:assert/strict';

import { eventLeaveByLine } from '@/lib/poppins/event-leave-by';

assert.equal(eventLeaveByLine({ time: '4' }), null, 'bare hour must not invent AM');
assert.equal(eventLeaveByLine({ time: 'in 15 minutes' }), null, 'relative phrase rejected');
assert.equal(eventLeaveByLine({ time: '' }), null);

{
  const line = eventLeaveByLine({ time: '4:30 PM', location: 'School' });
  assert.equal(line, 'Leave by 4:00 PM');
  assert.equal(line?.includes('25 min'), false, 'never invent drive estimate');
}

{
  const line = eventLeaveByLine({ time: '16:30' });
  assert.equal(line, 'Leave by 4:00 PM');
}

{
  const line = eventLeaveByLine({ time: '9am' });
  assert.equal(line, 'Leave by 8:30 AM');
}

console.log('PASS event-leave-by');
