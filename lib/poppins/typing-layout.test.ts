/**
 * The typing layout contract.
 *
 * Typing used to be cramped: the mic, its label and the Base/Max pills held about 150pt of the
 * screen the keyboard needed, so the thread was squeezed and text clipped. A full render needs
 * React Native, so this asserts the arrangement the files must keep.
 *
 * Run: npx tsx lib/poppins/typing-layout.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const tab = read('app/(tabs)/poppins.tsx');
const dock = read('components/orbit/poppins/poppins-dock.tsx');
const thread = read('components/orbit/poppins/poppins-thread-panel.tsx');
const tabBar = read('components/orbit/make-tab-bar.tsx');
const hook = read('lib/ui/use-keyboard-visible.ts');

// The keyboard is watched in one place, and it watches the events that fire before the animation.
assert.match(hook, /keyboardWillShow/, 'iOS listens for WillShow so layout moves with the keyboard');
assert.match(hook, /keyboardWillHide/);
assert.match(hook, /keyboardDidShow/, 'Android has no Will events');
assert.match(hook, /show\.remove\(\)/, 'listeners are torn down');
assert.match(hook, /hide\.remove\(\)/);

// The tab knows when typing is actually competing with the keyboard.
assert.match(tab, /useKeyboardState/);
assert.match(tab, /const typing = p\.threadOpen && keyboard\.visible/, 'typing means thread open AND keyboard up');

// The dock folds, the thread grows, the orb collapses.
assert.match(tab, /folded=\{typing\}/, 'the dock is told to fold');
assert.match(tab, /keyboardUp=\{typing\}/, 'the thread is told the keyboard is up');
assert.match(tab, /typing && styles\.orbSlotTyping/, 'the orb slot collapses');
assert.match(tab, /orbSlotTyping: \{ height: 0/, 'collapsed means no height');
assert.match(tab, /overflow: 'hidden'/, 'and clipped, not just transparent');
// The orb stays mounted while collapsed, so nothing restarts when the keyboard closes.
assert.equal(tab.split('<PoppinsOrb').length - 1, 1, 'still exactly one orb');

// A folded dock renders nothing — except something the person has to read.
assert.match(dock, /folded\?: boolean/);
assert.match(dock, /if \(folded\) \{/);
assert.match(dock, /if \(!p\.error && !p\.statusNotice\) return null/, 'nothing but a message survives');
const foldedBlock = dock.slice(dock.indexOf('if (folded) {'), dock.indexOf('return (\n    <View style={[styles.dock'));
assert.ok(!foldedBlock.includes('PoppinsModeCards'), 'no tier pills while typing');
assert.ok(!foldedBlock.includes('micBtn'), 'no mic button while typing');

// Leaving typing for voice must not depend on a button the keyboard is covering.
assert.match(thread, /keyboardUp\?: boolean/);
assert.match(thread, /panelTall: \{ flex: 4 \}/, 'the thread takes the room the dock gave up');
assert.match(thread, /keyboardUp && styles\.panelTall/);
assert.match(thread, /setThreadOpen\(false\)/, 'the composer can close typing');
assert.match(thread, /accessibilityLabel="Close typing and go back to speaking"/);
const composerAt = thread.indexOf('styles.composer');
assert.ok(composerAt > 0 && thread.indexOf('styles.backToVoice') > composerAt, 'the mic sits in the composer');

// The tab bar tightens rather than disappearing — the icons still say which tab is which.
assert.match(tabBar, /useKeyboardVisible/);
assert.match(tabBar, /keyboardUp && styles\.barCompact/);
assert.match(tabBar, /keyboardUp \? null :/, 'labels go, icons stay');
assert.match(tabBar, /keyboardUp \? 2 : Math\.max\(insets\.bottom/, 'the safe-area pad collapses too');

// Tap-to-edit reaches the fields people actually want to fix.
const field = read('components/orbit/poppins-stage/iui-inline-field.tsx');
assert.match(field, /poppinsUiOrchestrator\.freeze\(\)/, 'editing pauses the hold');
assert.match(field, /poppinsUiOrchestrator\.unfreeze\(\)/, 'and resumes it');
assert.match(field, /next !== value\.trim\(\)/, 'an unchanged value is not a turn');
assert.match(field, /selectTextOnFocus/, 'a correction starts selected');

const grocery = read('components/orbit/poppins-stage/iui-grocery-card.tsx');
assert.match(grocery, /IuiInlineField/, 'a grocery name can be retyped');
assert.match(grocery, /patchGroupItemLabel/, 'including one row of several');
assert.match(grocery, /tap a name to fix it/, 'and the card says so');

const trip = read('components/orbit/poppins-stage/iui-trip-card.tsx');
assert.match(trip, /kind: 'rename'; stopId: string/, 'a stop can be renamed');
assert.match(
  trip,
  /onPress=\{\(\) => openEditor\(\{ kind: 'address', stopId: stop\.id \}\)\}/,
  'every stop opens its address, not only the ones missing one'
);
assert.ok(
  !/if \(detail\.tone === 'ask' \|\| !stop\.address\) openEditor/.test(trip),
  'the old "only when blank" guard is gone'
);
assert.match(trip, /next\?\.kind === 'address' \? \(stop\?\.address \?\? ''\)/, 'the editor opens prefilled');

const row = read('components/orbit/poppins-stage/iui-row.tsx');
assert.match(row, /titleNode\?: React\.ReactNode/, 'a row can carry an editable name');

console.log('typing-layout: ok');
