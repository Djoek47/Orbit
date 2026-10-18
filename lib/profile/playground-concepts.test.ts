import assert from 'node:assert/strict';

import { playgroundConcepts } from '@/lib/profile/playground-concepts';

// The member's name is never sent, even when nothing was typed.
assert.deepEqual(playgroundConcepts('', ['Nero']).text, ['friendly character', 'profile picture']);

// "Nero dragon" → "dragon"; the name is reported so the sheet can say so.
const nero = playgroundConcepts('Nero dragon, flying', ['Nero']);
assert.deepEqual(nero.text, ['dragon', 'flying', 'friendly character', 'profile picture']);
assert.deepEqual(nero.removedNames, ['Nero']);

// Possessive, case, full names, other members.
assert.deepEqual(
  playgroundConcepts("nero's pet dragon, Mia Mugabo with a cape", ['Nero', 'Mia Mugabo']).text,
  ['pet dragon', 'with a cape', 'friendly character', 'profile picture']
);

// A name inside another word stays ("Neroli" is not "Nero").
assert.deepEqual(playgroundConcepts('neroli flowers', ['Nero']).text, ['neroli flowers', 'friendly character', 'profile picture']);

// A part that was only a name disappears.
assert.deepEqual(playgroundConcepts('Nero, dragon', ['Nero']).text, ['dragon', 'friendly character', 'profile picture']);

console.log('playground-concepts: ok');
