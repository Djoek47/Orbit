/**
 * No tour step may navigate to a screen presented as a modal in app/_layout.tsx.
 * Work Order 9.3 §4.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { allTourSteps } from '@/lib/tour/tour-steps';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const layout = readFileSync(join(root, 'app/_layout.tsx'), 'utf8');

const modalNames = new Set<string>();
for (const match of layout.matchAll(
  /name=["']([^"']+)["'][^}]*presentation:\s*['"]modal['"]/g
)) {
  modalNames.add(match[1]);
}
// Also catch presentation before name in options object form used here:
for (const match of layout.matchAll(
  /<Stack\.Screen\s+name=["']([^"']+)["'][^>]*\/>|<Stack\.Screen\s+name=["']([^"']+)["'][\s\S]*?\/>/g
)) {
  const name = match[1] ?? match[2];
  if (!name) continue;
  const blockStart = layout.indexOf(`name="${name}"`);
  const block = layout.slice(Math.max(0, blockStart - 20), blockStart + 220);
  if (block.includes("presentation: 'modal'") || block.includes('presentation: "modal"')) {
    modalNames.add(name);
  }
}

assert.ok(modalNames.has('settings'), 'expected settings to be a modal screen');
assert.ok(modalNames.has('assign-task'), 'expected assign-task to be a modal screen');

const offenders: string[] = [];
for (const { tourId, step } of allTourSteps()) {
  const route = step.route.replace(/^\//, '');
  const base = route.split('/')[0]?.replace(/^\(/, '').replace(/\)$/, '') ?? '';
  // Map "/settings" → settings, "/assign-task" → assign-task
  const candidates = [route, base, route.split('/').pop() ?? ''].filter(Boolean);
  for (const c of candidates) {
    if (modalNames.has(c)) {
      offenders.push(`${tourId}/${step.id} → ${step.route} (modal ${c})`);
      break;
    }
  }
}

assert.deepEqual(
  offenders,
  [],
  `tour steps must not target modal routes:\n${offenders.join('\n')}`
);

console.log(`PASS tour-modal-routes (${modalNames.size} modals checked)`);
