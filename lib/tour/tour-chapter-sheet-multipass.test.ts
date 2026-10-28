/**
 * Replay a part must never nest orbitAlert under Settings.
 * Run: npx --yes tsx --test lib/tour/tour-chapter-sheet-multipass.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { presentTourChapters } from '@/lib/tour/tour-chapter-meta';
import { chaptersForTour } from '@/lib/tour/tour-steps';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('Pass A: Settings opens chapter sheet after dismiss — never orbitAlert for Replay', () => {
  const settings = read('app/settings.tsx');
  assert.match(settings, /showTourChapterSheetAfterSettingsDismiss/);
  assert.match(settings, /Replay a part/);
  assert.doesNotMatch(
    settings,
    /orbitAlert\(\s*'Replay a part'/,
    'orbitAlert under Settings freezes iOS touches'
  );
  assert.match(settings, /closeSettingsModal\(\);\s*\n\s*showTourChapterSheetAfterSettingsDismiss/s);
});

test('Pass B: root host + controller wired like legal sheet', () => {
  const layout = read('app/_layout.tsx');
  assert.match(layout, /TourChapterSheetHost/);
  const host = read('components/orbit/tour/tour-chapter-sheet-host.tsx');
  assert.match(host, /FrostedPanel/);
  assert.match(host, /startChapter/);
  assert.match(host, /onDismiss=\{flushAfterDismiss\}/);
  assert.match(host, /beginDismiss/);
  const menus = read('lib/ui/settings-native-menus.ts');
  assert.match(menus, /showTourChapterSheetAfterSettingsDismiss/);
  assert.match(menus, /SESSION_NAV_DELAY_MS/);
  assert.match(menus, /openTourChapterSheet/);
});

test('Pass C: chapter presentation covers admin + sidekick chapters', () => {
  const admin = presentTourChapters(chaptersForTour('admin'));
  assert.ok(admin.length >= 5);
  assert.ok(admin.every((c) => c.name && c.icon && c.tone && c.subtitle.includes('step')));
  const sidekick = presentTourChapters(chaptersForTour('sidekick'));
  assert.equal(sidekick[0]?.id, 'sidekick_home');
});
