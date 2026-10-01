/**
 * The typing layout contract — IUI-first for people who type instead of speak.
 *
 * The old layout gave the thread flex 4 and left the stage a sliver under the keyboard, so
 * Add now missed and empty assistant turns drew as hollow purple ovals. Typing mode must keep
 * the stage usable, dismiss the keyboard on demand, and never paint blank bubbles.
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
const stage = read('components/orbit/poppins-stage.tsx');
const store = read('store/orbit-store.tsx');
const controller = read('lib/poppins/use-poppins-controller.ts');
const tabBar = read('components/orbit/make-tab-bar.tsx');
const hook = read('lib/ui/use-keyboard-visible.ts');

// The keyboard is watched in one place, and it watches the events that fire before the animation.
assert.match(hook, /keyboardWillShow/, 'iOS listens for WillShow so layout moves with the keyboard');
assert.match(hook, /keyboardWillHide/);
assert.match(hook, /keyboardDidShow/, 'Android has no Will events');
assert.match(hook, /show\.remove\(\)/, 'listeners are torn down');
assert.match(hook, /hide\.remove\(\)/);

// The tab knows when typing is actually competing with the keyboard.
// Typing mode is the chat being open — with the keyboard down too (it used to snap back).
assert.match(tab, /const typing = p\.threadOpen;/, 'typing means the chat is open');
assert.doesNotMatch(tab, /threadOpen && keyboard\.visible/, 'not only while the keyboard is up');
assert.match(tab, /setPoppinsTypingMode\(typing\)/, 'the tab bar is told');
assert.match(tabBar, /usePoppinsTypingMode\(\)/, 'and tightens for the whole mode');
assert.match(tab, /useKeyboardVisible/, 'soft keyboard visibility is tracked separately');
assert.match(tab, /keyboardUp=\{softKeyboard\}/, 'Done only cares about the soft keyboard');
assert.match(tab, /stageLive=\{Boolean\(live\)\}/, 'the thread knows when a card owns the stage');
assert.match(tab, /stageScrollTyping/, 'typing keeps the stage tall enough to tap');
assert.match(tab, /keyboardDismissMode="on-drag"/, 'dragging the stage dismisses the keyboard');

// The dock folds, the orb collapses; the stage stays when a card is live.
assert.match(tab, /folded=\{typing\}/, 'the dock is told to fold');
assert.match(tab, /typing && styles\.orbSlotTyping/, 'the orb slot collapses');
assert.match(tab, /orbSlotTyping: \{ height: 0/, 'collapsed means no height');
assert.match(tab, /overflow: 'hidden'/, 'and clipped, not just transparent');
assert.equal(tab.split('<PoppinsOrb').length - 1, 1, 'still exactly one orb');

// A folded dock renders nothing — except something the person has to read.
assert.match(dock, /folded\?: boolean/);
assert.match(dock, /if \(folded\) \{/);
assert.match(dock, /if \(!p\.error && !p\.statusNotice\) return null/, 'nothing but a message survives');
const foldedBlock = dock.slice(dock.indexOf('if (folded) {'), dock.indexOf('return (\n    <View style={[styles.dock'));
assert.ok(!foldedBlock.includes('PoppinsModeCards'), 'no tier pills while typing');
assert.ok(!foldedBlock.includes('micBtn'), 'no mic button while typing');

// Typing panel: Done hides the keyboard, Speak leaves typing, stage-live stays compact.
assert.match(thread, /keyboardUp\?: boolean/);
assert.match(thread, /stageLive\?: boolean/);
assert.match(thread, /panelCompact/, 'card on stage → composer strip');
assert.match(thread, /panelIdle/, 'idle typing gets a real studio');
assert.doesNotMatch(thread, /panelTall: \{ flex: 4 \}/, 'thread no longer steals the stage');
assert.match(thread, /Hide keyboard/, 'Done dismisses without leaving typing');
assert.match(thread, /setThreadOpen\(false\)/, 'Speak closes typing');
assert.match(thread, /accessibilityLabel="Close typing and go back to speaking"/);
assert.match(thread, /Keyboard\.dismiss/, 'soft keyboard can be put away');
assert.match(thread, /KEYBOARD_DONE_ID/, 'iOS accessory Done bar is wired');
assert.match(thread, /message\.role === 'user' \|\| Boolean\(message\.content\?\.trim\(\)\)/, 'blank assistant turns are filtered');

// Stage actions dismiss the keyboard so taps land.
assert.match(stage, /Keyboard\.dismiss\(\)/, 'stage dismisses before Add now / veto');
assert.match(stage, /onAddNow=\{\(\) => \{\s*Keyboard\.dismiss\(\);/, 'Add now frees the keyboard first');

// Store + Base never leave hollow assistant shells in the thread.
assert.match(store, /if \(a\) next\.push\(\{ role: 'assistant'/, 'empty answers are not drawn');
assert.match(controller, /replyForThread/, 'Base always writes a real reply');
assert.match(controller, /Keyboard\.dismiss\(\)/, 'Base dismisses when a card stages');
assert.match(controller, /import \{ AppState, Keyboard, Linking \}/, 'Keyboard is a top-level import');

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
