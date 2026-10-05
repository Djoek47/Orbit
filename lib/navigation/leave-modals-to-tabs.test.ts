import assert from 'node:assert/strict';
import test from 'node:test';

import { leaveModalsToTabs } from '@/lib/navigation/leave-modals-to-tabs';

test('dismisses modals then replaces to tabs', () => {
  const calls: string[] = [];
  leaveModalsToTabs({
    canDismiss: () => true,
    dismissAll: () => calls.push('dismissAll'),
    replace: (href) => calls.push(`replace:${href}`),
  });
  assert.deepEqual(calls, ['dismissAll', 'replace:/(tabs)']);
});

test('skips dismiss when nothing to dismiss', () => {
  const calls: string[] = [];
  leaveModalsToTabs({
    canDismiss: () => false,
    dismissAll: () => calls.push('dismissAll'),
    replace: (href) => calls.push(`replace:${href}`),
  });
  assert.deepEqual(calls, ['replace:/(tabs)']);
});
