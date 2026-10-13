/**
 * Run: npx --yes tsx --test lib/calendar/admin-plan-homework.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  defaultAdminPlanShowHomework,
  filterPlanItemsForAdminCalendar,
} from '@/lib/calendar/admin-plan-homework';
import type { PlanItem } from '@/lib/calendar/plan-items';

const items: PlanItem[] = [
  {
    id: 'e1',
    kind: 'event',
    title: 'Ranch trade',
    dateKey: '2026-10-05',
    href: '/event/e1',
  },
  {
    id: 'h1',
    kind: 'homework',
    title: 'Do your homework',
    dateKey: '2026-10-05',
    href: '/task/h1',
  },
];

describe('admin plan homework', () => {
  test('defaults to hidden for admin', () => {
    assert.equal(defaultAdminPlanShowHomework(), false);
  });

  test('admin with show off drops homework only', () => {
    const next = filterPlanItemsForAdminCalendar(items, { isAdmin: true, showHomework: false });
    assert.deepEqual(
      next.map((i) => i.id),
      ['e1']
    );
  });

  test('admin with show on keeps homework', () => {
    const next = filterPlanItemsForAdminCalendar(items, { isAdmin: true, showHomework: true });
    assert.equal(next.length, 2);
  });

  test('sidekick always keeps homework', () => {
    const next = filterPlanItemsForAdminCalendar(items, { isAdmin: false, showHomework: false });
    assert.equal(next.length, 2);
  });
});
