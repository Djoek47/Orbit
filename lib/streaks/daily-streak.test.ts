/**
 * Run: npx --yes tsx --test lib/streaks/daily-streak.test.ts
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('awardDailyStreakIfNeeded source contract', () => {
  test('fresh device continues from currentStreak instead of hard reset to 1', () => {
    const src = readFileSync(join(process.cwd(), 'lib/streaks/daily-streak.ts'), 'utf8');
    assert.match(src, /if \(!existing\)/);
    assert.match(src, /Math\.max\(1, Math\.max\(0, currentStreak\) \+ 1\)/);
    assert.doesNotMatch(
      src,
      /const nextStreak = continued \? \(existing\?\.streak \?\? currentStreak\) \+ 1 : 1/
    );
  });
});
