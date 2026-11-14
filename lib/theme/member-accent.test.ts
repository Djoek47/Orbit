/**
 * Shared-device accent cue — Jack orange, Emma yellow.
 * Run: npx --yes tsx lib/theme/member-accent.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getAccentTheme } from '@/constants/accent-themes';
import {
  knownMemberPaletteId,
  resolveMemberAccentColor,
  resolveMemberAccentTheme,
} from '@/lib/theme/member-accent';

assert.equal(knownMemberPaletteId('Jack'), 'coral');
assert.equal(knownMemberPaletteId('Emma'), 'citrus');
assert.equal(knownMemberPaletteId('Emma Rivera'), 'citrus');

const jack = resolveMemberAccentTheme({ name: 'Jack', accentThemeId: 'berry' });
assert.equal(jack.id, 'coral');
assert.equal(jack.primary, getAccentTheme('coral').primary);

const emma = resolveMemberAccentTheme({ name: 'Emma', accentThemeId: 'berry' });
assert.equal(emma.id, 'citrus');
assert.equal(emma.primary, getAccentTheme('citrus').primary);

assert.equal(resolveMemberAccentColor({ name: 'Jack' }), '#D85A30');
assert.equal(resolveMemberAccentColor({ name: 'Emma' }), '#EF9F27');

// Other kids keep stored packs.
const liam = resolveMemberAccentTheme({ name: 'Liam', accentThemeId: 'sky' });
assert.equal(liam.id, 'sky');

const tasks = readFileSync(join(process.cwd(), 'app/(tabs)/tasks.tsx'), 'utf8');
assert.match(tasks, /resolveMemberAccentTheme/);
assert.match(tasks, /accentColor=\{focusedAccent\}/);
assert.doesNotMatch(
  tasks,
  /WhosOnSwitcher[\s\S]{0,200}accentColor=\{accentTheme\.primary\}/
);

const store = readFileSync(join(process.cwd(), 'store/orbit-store.tsx'), 'utf8');
assert.match(store, /resolveMemberAccentTheme\(currentMember/);

const tabBar = readFileSync(join(process.cwd(), 'components/orbit/make-tab-bar.tsx'), 'utf8');
assert.match(tabBar, /accentPrimary/);
assert.match(tabBar, /LinearGradient\s*\n\s*colors=\{\[accentPrimary, accentSecondary\]\}/);

const emmaMock = readFileSync(join(process.cwd(), 'data/mock-household.ts'), 'utf8');
assert.match(emmaMock, /name: 'Emma'[\s\S]{0,400}?accentThemeId: 'citrus'/);
assert.match(emmaMock, /name: 'Jack'[\s\S]{0,400}?accentThemeId: 'coral'/);
assert.match(emmaMock, /sharedWithMemberIds: \['m3', 'm8'\]/);

console.log('member-accent: ok');
