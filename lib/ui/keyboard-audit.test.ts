/**
 * Every keyboard in the app has a way out.
 *
 * iOS puts a blue ✓ on a one-line field's return key, and a new-line key on a multi-line one.
 * Fields that went straight to React Native's TextInput got whatever the default was — a space
 * bar and a return key with nothing that says "done" — and Add place trapped people behind it.
 *
 * Run: npx tsx lib/ui/keyboard-audit.test.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(name) === '.tsx') out.push(full);
  }
  return out;
}

const files = [...walk(join(root, 'app')), ...walk(join(root, 'components'))].filter(
  (file) => !file.endsWith('app-text.tsx') && !file.includes('.test.')
);

// 1 · Every field goes through AppTextInput, which sets the return key and the Done bar.
const offenders: string[] = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (!/<TextInput[\s>]/.test(src)) continue;
  const aliased = /AppTextInput as TextInput/.test(src) || /\bAppTextInput\b/.test(src);
  if (!aliased) offenders.push(relative(root, file));
}
assert.deepEqual(offenders, [], `these fields bypass AppTextInput:\n${offenders.join('\n')}`);

// 2 · The component itself does the work.
const input = readFileSync(join(root, 'components/orbit/app-text.tsx'), 'utf8');
assert.match(input, /multiline \? undefined : 'done'/, 'one line ends with the blue tick');
assert.match(input, /KEYBOARD_DONE_ID/, 'several lines get the Done bar');
assert.match(input, /forwardRef/, 'and refs still reach the real input');

// 3 · The bar is mounted once, above everything.
assert.match(
  readFileSync(join(root, 'app/_layout.tsx'), 'utf8'),
  /<KeyboardDoneAccessory \/>/,
  'the Done bar exists in the tree'
);
const bar = readFileSync(join(root, 'components/orbit/keyboard-done-accessory.tsx'), 'utf8');
assert.match(bar, /InputAccessoryView/);
assert.match(bar, /Keyboard\.dismiss\(\)/, 'and tapping it closes the keyboard');

// 4 · Nothing asks for a return key on a field that should finish.
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  assert.ok(
    !/returnKeyType="default"/.test(src),
    `${relative(root, file)} asks for a plain return key`
  );
}

console.log(`keyboard-audit: ok (${files.filter((f) => /<TextInput[\s>]/.test(readFileSync(f, 'utf8'))).length} screens with fields)`);
