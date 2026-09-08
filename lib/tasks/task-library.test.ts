/**
 * Assert task library seed counts — `npm run test:task-library-v2`.
 * Spec §12 QA.
 */

import { libraryStats } from '@/lib/tasks/task-library';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const s = libraryStats();
assert(s.domains === 15, `domains ${s.domains}`);
assert(s.groups === 43, `groups ${s.groups}`);
assert(s.tasks === 150, `tasks ${s.tasks}`);
assert(s.xpScoring === 131, `xp ${s.xpScoring}`);
assert(s.streak === 19, `streak ${s.streak}`);
assert(s.choresDomains === 14, `chore domains ${s.choresDomains}`);
assert(s.dist[5] === 35, '35×5');
assert(s.dist[10] === 43, '43×10');
assert(s.dist[15] === 26, '26×15');
assert(s.dist[20] === 12, '12×20');
assert(s.dist[25] === 11, '11×25');
assert(s.dist[30] === 4, '4×30');

console.log('test:task-library-v2 OK', s);
