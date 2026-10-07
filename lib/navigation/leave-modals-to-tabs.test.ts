import assert from 'node:assert/strict';
import test from 'node:test';

import { leaveModalsToTabs } from '@/lib/navigation/leave-modals-to-tabs';

test('dismisses one modal and does not replace (avoids zombie touch layer)', () => {
  const calls: string[] = [];
  leaveModalsToTabs({
    canDismiss: () => true,
    dismiss: () => calls.push('dismiss'),
    dismissAll: () => calls.push('dismissAll'),
    replace: (href) => calls.push(`replace:${href}`),
  });
  assert.deepEqual(calls, ['dismiss']);
});

test('falls back to dismissAll when dismiss is missing', () => {
  const calls: string[] = [];
  leaveModalsToTabs({
    canDismiss: () => true,
    dismissAll: () => calls.push('dismissAll'),
    replace: (href) => calls.push(`replace:${href}`),
  });
  assert.deepEqual(calls, ['dismissAll']);
});

test('falls back to back when nothing to dismiss', () => {
  const calls: string[] = [];
  leaveModalsToTabs({
    canDismiss: () => false,
    canGoBack: () => true,
    back: () => calls.push('back'),
    replace: (href) => calls.push(`replace:${href}`),
  });
  assert.deepEqual(calls, ['back']);
});

test('replace only when dismiss and back are unavailable', () => {
  const calls: string[] = [];
  leaveModalsToTabs({
    canDismiss: () => false,
    canGoBack: () => false,
    replace: (href) => calls.push(`replace:${href}`),
  });
  assert.deepEqual(calls, ['replace:/(tabs)']);
});
