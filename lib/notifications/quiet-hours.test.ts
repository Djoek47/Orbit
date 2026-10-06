/**
 * Quiet hours window helpers.
 * Run: npx --yes tsx --test lib/notifications/quiet-hours.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_QUIET_HOURS_END,
  DEFAULT_QUIET_HOURS_START,
  isInQuietHoursWindow,
  normalizeQuietHm,
  quietHoursBodyCopy,
  quietHoursChipLabel,
  quietHoursPickerValues,
} from '@/lib/notifications/quiet-hours';

describe('normalizeQuietHm', () => {
  it('pads and falls back', () => {
    assert.equal(normalizeQuietHm('9:00', DEFAULT_QUIET_HOURS_START), '09:00');
    assert.equal(normalizeQuietHm('bogus', DEFAULT_QUIET_HOURS_END), '07:00');
  });
});

describe('isInQuietHoursWindow', () => {
  it('default 21→07 wraps midnight', () => {
    assert.equal(isInQuietHoursWindow({ localHour: 21 }), true);
    assert.equal(isInQuietHoursWindow({ localHour: 23 }), true);
    assert.equal(isInQuietHoursWindow({ localHour: 0 }), true);
    assert.equal(isInQuietHoursWindow({ localHour: 6, localMinute: 59 }), true);
    assert.equal(isInQuietHoursWindow({ localHour: 7 }), false);
    assert.equal(isInQuietHoursWindow({ localHour: 20, localMinute: 59 }), false);
  });

  it('respects custom same-day window', () => {
    assert.equal(
      isInQuietHoursWindow({
        localHour: 14,
        startHm: '13:00',
        endHm: '15:00',
      }),
      true
    );
    assert.equal(
      isInQuietHoursWindow({
        localHour: 16,
        startHm: '13:00',
        endHm: '15:00',
      }),
      false
    );
  });

  it('degenerate start===end is never quiet', () => {
    assert.equal(
      isInQuietHoursWindow({ localHour: 22, startHm: '10:00', endHm: '10:00' }),
      false
    );
  });
});

describe('copy helpers', () => {
  it('builds range + body', () => {
    assert.equal(quietHoursChipLabel('21:00', '07:00'), '21–7');
    assert.match(quietHoursBodyCopy('22:00', '06:00'), /22:00–06:00/);
    assert.equal(quietHoursPickerValues().length, 24);
    assert.equal(quietHoursPickerValues()[0], '00:00');
    assert.equal(DEFAULT_QUIET_HOURS_START, '21:00');
  });
});
