/**
 * Shopping-run helpers tests (no RN).
 */
import assert from 'node:assert/strict';

import {
  groupShoppingAisles,
  resolveShoppingPalette,
  shoppingProgress,
  shoppingRunLabel,
  type OrbitColorLike,
  type ShoppingListItem,
} from '@/lib/grocery/shopping-palette';

function pass(id: string, detail: string) {
  console.log(`PASS ${id} — ${detail}`);
}

const MOCK: OrbitColorLike = {
  background: '#070D1C',
  backgroundSoft: '#0A1525',
  shell: '#030810',
  text: '#EEF2FF',
  textSoft: '#C8D8F0',
  textMuted: '#7C9CC0',
  textSubtle: '#4B6080',
  textFaint: '#2A3A54',
  success: '#34D399',
  warning: '#FB923C',
  danger: '#F87171',
  accent: '#7DDBB0',
  card: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.08)',
};

{
  const p = resolveShoppingPalette(MOCK);
  assert.ok(p.olive);
  assert.ok(p.ember);
  assert.ok(p.glass);
  pass('SP1', 'palette maps olive/ember/glass roles');
}

{
  const items: ShoppingListItem[] = [
    { id: '1', name: 'Milk', category: 'Dairy & Eggs', categoryId: 'dairy_eggs', done: false },
    { id: '2', name: 'Eggs', category: 'Dairy & Eggs', categoryId: 'dairy_eggs', done: true },
    { id: '3', name: 'Apple', category: 'Produce', categoryId: 'produce', done: false },
  ];
  const fakeGroup = <T extends { category: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const r of rows) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return [...map.entries()].map(([categoryName, its]) => ({
      categoryId: categoryName.toLowerCase().replace(/\s+/g, '_'),
      categoryName,
      items: its,
    }));
  };
  const aisles = groupShoppingAisles(items, fakeGroup);
  const dairy = aisles.find((a) => a.categoryName === 'Dairy & Eggs');
  assert.ok(dairy);
  assert.equal(dairy!.items[0].done, false);
  assert.equal(dairy!.items[1].done, true);
  assert.equal(dairy!.remaining, 1);
  pass('SP2', 'aisle sort undone first; remaining counts undone');
}

{
  const prog = shoppingProgress([
    { id: '1', name: 'A', category: 'X', done: true },
    { id: '2', name: 'B', category: 'X', done: false },
    { id: '3', name: 'C', category: 'X', done: true },
  ]);
  assert.equal(prog.total, 3);
  assert.equal(prog.done, 2);
  assert.equal(prog.left, 1);
  assert.ok(Math.abs(prog.ratio - 2 / 3) < 0.01);
  pass('SP3', 'progress ratio N left / X of Y');
}

{
  const label = shoppingRunLabel(new Date('2026-08-08T12:00:00'));
  assert.match(label, /run$/i);
  pass('SP4', 'run eyebrow label');
}

console.log('\nAll shopping-palette tests passed.');
